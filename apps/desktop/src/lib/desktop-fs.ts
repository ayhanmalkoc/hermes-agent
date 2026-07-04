import type {
  HermesConnection,
  HermesReadDirResult,
  HermesReadFileTextResult,
  HermesSelectPathsOptions
} from '@/global'
import { $connection } from '@/store/session'

export interface DesktopFsRemotePicker {
  selectPaths: (options?: HermesSelectPathsOptions) => Promise<string[]>
}

let remotePicker: DesktopFsRemotePicker | null = null

export function setDesktopFsRemotePicker(next: DesktopFsRemotePicker | null) {
  remotePicker = next
}

function connectionCacheKey(connection: HermesConnection | null) {
  if (!connection) {
    return 'local:'
  }

  return `${connection.mode || 'local'}:${connection.profile || ''}:${connection.baseUrl || ''}`
}

export function desktopFsCacheKey() {
  return connectionCacheKey($connection.get())
}

export function isDesktopFsRemoteMode() {
  return $connection.get()?.mode === 'remote'
}

// Active profile for FS/git REST calls. Without it the Electron api bridge
// hits the primary (local) backend even when the user switched to a remote profile.
export function desktopFsProfile(): string | undefined {
  return $connection.get()?.profile || undefined
}

function fsPath(endpoint: string, filePath: string, params?: Record<string, number | string | undefined>) {
  const search = [`path=${encodeURIComponent(filePath)}`]

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      search.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }

  return `/api/fs/${endpoint}?${search.join('&')}`
}

function bridge() {
  const desktop = window.hermesDesktop

  if (!desktop) {
    throw new Error('Hermes Desktop bridge is unavailable')
  }

  return desktop
}

function remoteFsApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return bridge().api<T>(
    body ? { body, method: 'POST', path, profile: desktopFsProfile() } : { path, profile: desktopFsProfile() }
  )
}

function isMissingRemoteMkdirEndpoint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /\b(404|405)\b/.test(message) && /\/api\/fs\/mkdir|Method Not Allowed|Not Found/i.test(message)
}

export async function readDesktopDir(path: string): Promise<HermesReadDirResult> {
  if (!isDesktopFsRemoteMode()) {
    return bridge().readDir(path)
  }

  return remoteFsApi<HermesReadDirResult>(fsPath('list', path))
}

export async function createDesktopDir(path: string): Promise<{ path: string }> {
  const desktop = bridge()

  if (!isDesktopFsRemoteMode()) {
    if (!desktop.createDir) {
      throw new Error('Create folder is not available')
    }

    return desktop.createDir(path)
  }

  let result: { ok?: boolean; path?: string }

  try {
    result = await remoteFsApi<{ ok?: boolean; path?: string }>('/api/fs/mkdir', { path })
  } catch (error) {
    if (isMissingRemoteMkdirEndpoint(error)) {
      throw new Error(
        'Remote Hermes backend does not support folder creation yet. Update/restart the remote gateway, or choose an existing folder with Add folder.'
      )
    }

    throw error
  }

  return { path: result.path || path }
}

export async function readDesktopFileText(path: string, options?: { maxBytes?: number }): Promise<HermesReadFileTextResult> {
  if (!isDesktopFsRemoteMode()) {
    return options ? bridge().readFileText(path, options) : bridge().readFileText(path)
  }

  return remoteFsApi<HermesReadFileTextResult>(fsPath('read-text', path, { maxBytes: options?.maxBytes }))
}

// Save UTF-8 text back to a file. Local writes go through the hardened Electron
// IPC; remote writes hit the dashboard's POST /api/fs/write-text (same path
// hardening, parent-must-exist, size cap) so the editor behaves identically in
// both modes. Stale-on-disk detection is the caller's job (re-read before save).
export async function writeDesktopFileText(path: string, content: string): Promise<{ path: string }> {
  const desktop = bridge()

  if (!isDesktopFsRemoteMode()) {
    if (!desktop.writeTextFile) {
      throw new Error('Saving is not available')
    }

    return desktop.writeTextFile(path, content)
  }

  const result = await remoteFsApi<{ ok?: boolean; path?: string }>('/api/fs/write-text', { content, path })

  return { path: result.path || path }
}

export async function readDesktopFileDataUrl(path: string): Promise<string> {
  if (!isDesktopFsRemoteMode()) {
    return bridge().readFileDataUrl(path)
  }

  const result = await remoteFsApi<string | { dataUrl?: string }>(fsPath('read-data-url', path))

  return typeof result === 'string' ? result : result.dataUrl || ''
}

export async function desktopGitRoot(path: string): Promise<string | null> {
  const desktop = bridge()

  if (!isDesktopFsRemoteMode()) {
    return desktop.gitRoot ? desktop.gitRoot(path) : null
  }

  return (await remoteFsApi<{ root: string | null }>(fsPath('git-root', path))).root
}

export async function desktopDefaultCwd(): Promise<{ branch: string; cwd: string } | null> {
  if (!isDesktopFsRemoteMode()) {
    return null
  }

  return remoteFsApi<{ branch: string; cwd: string }>('/api/fs/default-cwd')
}

// Reveal a path in the OS file manager (Finder / Explorer / Files). Local only.
export async function revealDesktopPath(path: string): Promise<void> {
  await bridge().revealPath?.(path)
}

// Rename a file/folder in place; returns the new absolute path. Local only.
export async function renameDesktopPath(path: string, newName: string): Promise<string> {
  const desktop = bridge()

  if (!desktop.renamePath) {
    throw new Error('Rename is not available')
  }

  const result = await desktop.renamePath(path, newName)

  return result.path
}

// Move a file/folder to the OS trash (recoverable). Local only.
export async function trashDesktopPath(path: string): Promise<void> {
  const desktop = bridge()

  if (!desktop.trashPath) {
    throw new Error('Delete is not available')
  }

  await desktop.trashPath(path)
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await bridge().writeClipboard(text)
}

// Working-tree-vs-HEAD diff for one file. Empty when unchanged / not a repo.
// Remote gateway → backend git (/api/git/file-diff); local → Electron git.
export async function desktopFileDiff(repoRoot: string, filePath: string): Promise<string> {
  if (isDesktopFsRemoteMode()) {
    const result = await remoteFsApi<{ diff: string }>(
      `/api/git/file-diff?path=${encodeURIComponent(repoRoot)}&file=${encodeURIComponent(filePath)}`
    )

    return result.diff || ''
  }

  const git = bridge().git

  return git?.fileDiff ? git.fileDiff(repoRoot, filePath) : ''
}

export async function selectDesktopPaths(options?: HermesSelectPathsOptions): Promise<string[]> {
  const desktop = bridge()

  if (!isDesktopFsRemoteMode()) {
    return desktop.selectPaths(options)
  }

  if (!options?.directories) {
    return desktop.selectPaths(options)
  }

  return remotePicker ? remotePicker.selectPaths({ ...options, multiple: false }) : []
}

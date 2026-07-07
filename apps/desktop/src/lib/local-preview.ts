import { isDesktopFsRemoteMode, readDesktopFileText } from '@/lib/desktop-fs'
import { mediaExternalUrl } from '@/lib/media'
import type { PreviewTarget } from '@/store/preview'
import { $connection } from '@/store/session'

const HTML_EXTENSIONS = new Set(['.htm', '.html'])
const IMAGE_EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.opus', '.wav'])
const VIDEO_EXTENSIONS = new Set(['.avi', '.m4v', '.mov', '.mp4', '.mpeg', '.mpg', '.webm'])
const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
  '.7z',
  '.asar',
  '.bin',
  '.db',
  '.dmg',
  '.dll',
  '.doc',
  '.docx',
  '.exe',
  '.gz',
  '.ico',
  '.jar',
  '.msi',
  '.pdf',
  '.sqlite',
  '.tar',
  '.tgz',
  '.wasm',
  '.xls',
  '.xlsx',
  '.zip'
])

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.c': 'c',
  '.conf': 'ini',
  '.cpp': 'cpp',
  '.css': 'css',
  '.csv': 'csv',
  '.go': 'go',
  '.graphql': 'graphql',
  '.h': 'c',
  '.hpp': 'cpp',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'jsx',
  '.log': 'text',
  '.lua': 'lua',
  '.md': 'markdown',
  '.mjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.sh': 'shell',
  '.sql': 'sql',
  '.svg': 'xml',
  '.toml': 'toml',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.txt': 'text',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.zsh': 'shell'
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() || value
}

function extension(value: string) {
  const clean = value.split(/[?#]/, 1)[0] || value
  const idx = clean.lastIndexOf('.')

  return idx >= 0 ? clean.slice(idx).toLowerCase() : ''
}

function joinPath(base: string, rel: string) {
  if (!base) {
    return rel
  }

  return `${base.replace(/\/+$/, '')}/${rel.replace(/^\.?\//, '')}`
}

function pathToFileUrl(path: string) {
  const encoded = path
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/')

  return `file://${encoded.startsWith('/') ? encoded : `/${encoded}`}`
}

function isLocalPreviewUrl(raw: string): boolean {
  try {
    const url = new URL(raw)

    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function remoteGatewayUrl(raw: string): string {
  if (!isDesktopFsRemoteMode() || !isLocalPreviewUrl(raw)) {
    return raw
  }

  const conn = $connection.get()

  if (!conn?.baseUrl) {
    return raw
  }

  try {
    const target = new URL(raw)
    const gateway = new URL(conn.baseUrl)

    target.protocol = gateway.protocol
    target.hostname = gateway.hostname

    return target.toString()
  } catch {
    return raw
  }
}

async function remoteGatewayPreviewProxyUrl(raw: string): Promise<string | null> {
  if (!isDesktopFsRemoteMode() || !isLocalPreviewUrl(raw)) {
    return null
  }

  try {
    const result = await window.hermesDesktop?.api<{ url: string }>({
      body: { url: raw },
      method: 'POST',
      path: '/api/preview/tickets'
    })
    const baseUrl = $connection.get()?.baseUrl

    if (!result?.url || !baseUrl) {
      return null
    }

    return new URL(result.url, baseUrl).toString()
  } catch {
    return null
  }
}

export function localPreviewTarget(rawTarget: string, cwd?: string | null): PreviewTarget | null {
  const raw = rawTarget.trim().replace(/^`|`$/g, '')

  if (!raw) {
    return null
  }

  if (/^https?:\/\//i.test(raw)) {
    const url = remoteGatewayUrl(raw)

    return { kind: 'url', label: basename(url), source: raw, url }
  }

  let path = raw

  if (/^file:\/\//i.test(raw)) {
    try {
      path = decodeURIComponent(new URL(raw).pathname)
    } catch {
      path = raw.replace(/^file:\/\//i, '')
    }
  } else if (!raw.startsWith('/') && cwd) {
    path = joinPath(cwd, raw)
  }

  const ext = extension(path)
  const isHtml = HTML_EXTENSIONS.has(ext)
  const isImage = IMAGE_EXTENSIONS.has(ext)
  const isAudio = AUDIO_EXTENSIONS.has(ext)
  const isVideo = VIDEO_EXTENSIONS.has(ext)
  const isUnsupportedBinary = UNSUPPORTED_BINARY_EXTENSIONS.has(ext)
  const remote = isDesktopFsRemoteMode()

  return {
    kind: 'file',
    label: basename(path),
    language: LANGUAGE_BY_EXT[ext] || 'text',
    path,
    // Renderer fallback can't stat/sniff without reading; assume text unless
    // image/html extension says otherwise. LocalFilePreview still guards
    // binary/large files when readFileText/readFileDataUrl returns metadata.
    binary: isUnsupportedBinary,
    previewKind: isUnsupportedBinary ? 'binary' : isHtml ? 'html' : isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'text',
    renderMode: remote ? 'source' : undefined,
    source: raw,
    url: remote ? mediaExternalUrl(path) : pathToFileUrl(path)
  }
}

async function enrichPreviewTarget(target: PreviewTarget | null): Promise<PreviewTarget | null> {
  if (!isDesktopFsRemoteMode() || !target || target.kind !== 'file' || target.previewKind === 'image' || target.previewKind === 'audio' || target.previewKind === 'video') {
    return target
  }

  try {
    const result = await readDesktopFileText(target.path || target.source)

    return {
      ...target,
      binary: result.binary,
      byteSize: result.byteSize,
      language: result.language || target.language,
      large: false,
      mimeType: result.mimeType
    }
  } catch {
    return target
  }
}

export async function normalizeOrLocalPreviewTarget(
  rawTarget: string,
  cwd?: string | null
): Promise<PreviewTarget | null> {
  const raw = rawTarget.trim()

  if (/^https?:\/\//i.test(raw)) {
    const proxied = await remoteGatewayPreviewProxyUrl(raw)

    if (proxied) {
      return { kind: 'url', label: basename(raw), source: raw, url: proxied }
    }
  }

  if (isDesktopFsRemoteMode() && !/^https?:\/\//i.test(rawTarget.trim())) {
    return enrichPreviewTarget(localPreviewTarget(rawTarget, cwd))
  }

  try {
    const normalized = await window.hermesDesktop?.normalizePreviewTarget?.(rawTarget, cwd || undefined)

    if (normalized) {
      return enrichPreviewTarget(normalized)
    }
  } catch {
    // Running Electron may still have the old HTML-only preview IPC. Fall
    // through to renderer-side local classification so text/images still open.
  }

  return enrichPreviewTarget(localPreviewTarget(rawTarget, cwd))
}

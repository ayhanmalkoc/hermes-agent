import { atom, computed } from 'nanostores'

import {
  $rightWorkspaceTabs,
  closeRightWorkspaceTabsForTarget,
  openBrowserWorkspace,
  openFilesWorkspaceTarget,
  rightWorkspaceTabMatchesTarget
} from './right-workspace'
import { $activeSessionId, $selectedStoredSessionId } from './session'

export interface PreviewTarget {
  binary?: boolean
  byteSize?: number
  /** Inline image bytes (a `data:` URL) when the renderer already holds them —
   * e.g. a pasted/dropped screenshot whose only on-disk copy is a transient
   * path the preview can't reliably re-read. Rendered directly and NOT
   * persisted to the session-preview registry (it would bloat localStorage). */
  dataUrl?: string
  kind: 'file' | 'url'
  label: string
  large?: boolean
  language?: string
  mimeType?: string
  path?: string
  previewKind?: 'audio' | 'binary' | 'html' | 'image' | 'text' | 'video'
  renderMode?: 'preview' | 'source'
  source: string
  url: string
}

export interface PreviewServerRestart {
  message?: string
  status: 'complete' | 'error' | 'running'
  taskId: string
  url: string
}

export type PreviewRecordSource = 'artifact' | 'explicit-link' | 'file-browser' | 'manual' | 'tool-result'

export interface SessionPreviewRecord {
  autoOpen?: boolean
  createdAt: number
  dismissedAt?: number
  id: string
  normalized: PreviewTarget
  sessionId: string
  source: PreviewRecordSource
  target: string
}

const REGISTRY_STORAGE_KEY = 'hermes.desktop.sessionPreviews.v1'
type SessionPreviewRegistry = Record<string, SessionPreviewRecord[]>

export const $previewTarget = atom<PreviewTarget | null>(null)
export const $previewReloadRequest = atom(0)
export const $previewServerRestart = atom<PreviewServerRestart | null>(null)
export const $previewServerRestartStatus = computed($previewServerRestart, restart => restart?.status ?? 'idle')
export const $sessionPreviewRegistry = atom<SessionPreviewRegistry>({})

$rightWorkspaceTabs.subscribe(tabs => {
  const current = $previewTarget.get()

  if (current && !tabs.some(tab => rightWorkspaceTabMatchesTarget(tab, current))) {
    $previewTarget.set(null)
  }
})

function isSamePreviewTarget(a: PreviewTarget | null, b: PreviewTarget | null): boolean {
  if (a === b) {
    return true
  }

  if (!a || !b) {
    return false
  }

  return (
    a.kind === b.kind &&
    a.label === b.label &&
    a.renderMode === b.renderMode &&
    a.source === b.source &&
    a.url === b.url
  )
}

function isFileSourceOpen(source: PreviewRecordSource): boolean {
  return source === 'file-browser' || source === 'manual'
}

function isBrowserPreviewTarget(target: PreviewTarget, source: PreviewRecordSource): boolean {
  if (target.kind === 'url') {
    return true
  }

  return target.kind === 'file' && target.previewKind === 'html' && !isFileSourceOpen(source)
}

export function openPreviewTarget(target: PreviewTarget, source: PreviewRecordSource): void {
  const normalized = previewTargetForSource(target, source)

  if (isBrowserPreviewTarget(normalized, source)) {
    openBrowserWorkspace(normalized.url, true, { target: normalized })
    return
  }

  openFilesWorkspaceTarget(normalized)
}

export function setPreviewTarget(target: PreviewTarget | null) {
  if (isSamePreviewTarget($previewTarget.get(), target)) {
    if (target) {
      openPreviewTarget(target, 'tool-result')
    }

    return
  }

  $previewTarget.set(target)

  if (target) {
    openPreviewTarget(target, 'tool-result')
  }
}

function previewTargetForSource(target: PreviewTarget, source: PreviewRecordSource): PreviewTarget {
  if (target.kind !== 'file' || target.previewKind !== 'html') {
    return target
  }

  return { ...target, renderMode: isFileSourceOpen(source) ? 'source' : 'preview' }
}

function tryOpenFilePreview(target: PreviewTarget, source: PreviewRecordSource): boolean {
  if (target.kind !== 'file' || !isFileSourceOpen(source)) {
    return false
  }

  openPreviewTarget(target, source)

  return true
}

function clearLegacySessionPreviewRegistry() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(REGISTRY_STORAGE_KEY)
  } catch {
    // Legacy preview registry cleanup is best effort.
  }
}

clearLegacySessionPreviewRegistry()

function currentPreviewSessionId(): string {
  return $selectedStoredSessionId.get() || $activeSessionId.get() || ''
}

export function registerSessionPreview(
  sessionId: string | null | undefined,
  target: PreviewTarget,
  source: PreviewRecordSource,
  rawTarget = target.source
): SessionPreviewRecord | null {
  void sessionId
  void target
  void source
  void rawTarget

  clearLegacySessionPreviewRegistry()

  return null
}

export function setSessionPreviewTarget(
  sessionId: string | null | undefined,
  target: PreviewTarget,
  source: PreviewRecordSource,
  rawTarget = target.source
): SessionPreviewRecord | null {
  if (tryOpenFilePreview(target, source)) {
    return null
  }

  void sessionId
  void rawTarget

  const normalized = previewTargetForSource(target, source)
  $previewTarget.set(normalized)
  openPreviewTarget(normalized, source)

  clearLegacySessionPreviewRegistry()

  return null
}

export function setCurrentSessionPreviewTarget(
  target: PreviewTarget,
  source: PreviewRecordSource,
  rawTarget = target.source
): SessionPreviewRecord | null {
  return setSessionPreviewTarget(currentPreviewSessionId(), target, source, rawTarget)
}

export function getSessionPreviewRecord(sessionId: string | null | undefined): SessionPreviewRecord | null {
  void sessionId

  return null
}

export function dismissSessionPreview(sessionId: string | null | undefined, url?: string) {
  void sessionId
  void url

  clearLegacySessionPreviewRegistry()
}

/** User clicked close — clear the pointer and close the matching right workspace tab. */
export function dismissPreviewTarget() {
  const current = $previewTarget.get()

  if (current?.url) {
    closeRightWorkspaceTabsForTarget(current)
  }

  $previewTarget.set(null)
}

export function clearSessionPreviewRegistry() {
  $sessionPreviewRegistry.set({})
  setPreviewTarget(null)
  clearLegacySessionPreviewRegistry()
}

export function requestPreviewReload() {
  $previewReloadRequest.set($previewReloadRequest.get() + 1)
}

export function beginPreviewServerRestart(taskId: string, url: string) {
  $previewServerRestart.set({ status: 'running', taskId, url })
}

export function completePreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId) {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text,
    status: text.trim().toLowerCase().startsWith('error:') ? 'error' : 'complete'
  })
}

export function progressPreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text
  })
}

export function failPreviewServerRestart(taskId: string, message: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message,
    status: 'error'
  })
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $paneOpen } from './panes'
import {
  $previewServerRestart,
  $previewServerRestartStatus,
  $previewTarget,
  $sessionPreviewRegistry,
  beginPreviewServerRestart,
  clearSessionPreviewRegistry,
  dismissPreviewTarget,
  getSessionPreviewRecord,
  type PreviewTarget,
  progressPreviewServerRestart,
  setCurrentSessionPreviewTarget
} from './preview'
import { $activeSessionId, $selectedStoredSessionId } from './session'
import { $activeRightWorkspaceTab, $activeRightWorkspaceTabId, $rightWorkspaceTabs, RIGHT_WORKSPACE_PANE_ID } from './right-workspace'

function previewTarget(source: string): PreviewTarget {
  return {
    kind: 'file',
    label: source,
    path: source,
    previewKind: 'html',
    source,
    url: `file://${source}`
  }
}

function withRenderMode(target: PreviewTarget, renderMode: PreviewTarget['renderMode']): PreviewTarget {
  return { ...target, renderMode }
}

describe('preview store', () => {
  beforeEach(() => {
    $previewServerRestart.set(null)
    $activeSessionId.set('session-1')
    $selectedStoredSessionId.set(null)
    window.localStorage.clear()
    clearSessionPreviewRegistry()
    $rightWorkspaceTabs.set([])
    $activeRightWorkspaceTabId.set(null)
  })

  afterEach(() => {
    $previewServerRestart.set(null)
    $activeSessionId.set(null)
    $selectedStoredSessionId.set(null)
    window.localStorage.clear()
    clearSessionPreviewRegistry()
    $rightWorkspaceTabs.set([])
    $activeRightWorkspaceTabId.set(null)
  })

  it('does not notify status subscribers for restart progress text', () => {
    const statuses: string[] = []
    const unsubscribe = $previewServerRestartStatus.subscribe(status => statuses.push(status))

    beginPreviewServerRestart('task-1', 'http://localhost:5174')
    progressPreviewServerRestart('task-1', 'first line')
    progressPreviewServerRestart('task-1', 'second line')
    unsubscribe()

    expect(statuses).toEqual(['idle', 'running'])
  })

  it('opens previews through right workspace without registering session previews', () => {
    const target = previewTarget('/work/demo.html')

    setCurrentSessionPreviewTarget(target, 'tool-result')

    expect($previewTarget.get()).toEqual(withRenderMode(target, 'preview'))
    expect($paneOpen(RIGHT_WORKSPACE_PANE_ID).get()).toBe(true)
    expect($activeRightWorkspaceTab.get()).toMatchObject({
      kind: 'browser',
      target: withRenderMode(target, 'preview'),
      url: 'file:///work/demo.html'
    })
    expect(getSessionPreviewRecord('session-1')).toBeNull()
    expect($sessionPreviewRegistry.get()).toEqual({})
    expect(window.localStorage.getItem('hermes.desktop.sessionPreviews.v1')).toBeNull()

    dismissPreviewTarget()

    expect($previewTarget.get()).toBeNull()
    expect($paneOpen(RIGHT_WORKSPACE_PANE_ID).get()).toBe(true)
    expect(getSessionPreviewRecord('session-1')).toBeNull()
    expect($rightWorkspaceTabs.get()).toEqual([])

    setCurrentSessionPreviewTarget(target, 'tool-result')

    expect(getSessionPreviewRecord('session-1')).toBeNull()
  })

  it('keeps multiple workspace previews as tabs instead of a registry back stack', () => {
    const first = previewTarget('/work/first.html')
    const second = previewTarget('/work/second.html')

    setCurrentSessionPreviewTarget(first, 'tool-result')
    setCurrentSessionPreviewTarget(second, 'tool-result')

    expect($sessionPreviewRegistry.get()).toEqual({})
    expect(getSessionPreviewRecord('session-1')).toBeNull()
    expect($rightWorkspaceTabs.get()).toMatchObject([
      { kind: 'browser', target: withRenderMode(first, 'preview'), url: 'file:///work/first.html' },
      { kind: 'browser', target: withRenderMode(second, 'preview'), url: 'file:///work/second.html' }
    ])
    expect($activeRightWorkspaceTab.get()).toMatchObject({ kind: 'browser', url: 'file:///work/second.html' })

    dismissPreviewTarget()

    expect($previewTarget.get()).toBeNull()
    expect(getSessionPreviewRecord('session-1')).toBeNull()
    expect($rightWorkspaceTabs.get()).toMatchObject([{ kind: 'browser', url: 'file:///work/first.html' }])
  })

  it('keeps file inspection separate from live preview', () => {
    const target = previewTarget('/work/demo.html')
    const preview = previewTarget('/work/live.html')

    setCurrentSessionPreviewTarget(preview, 'tool-result')

    setCurrentSessionPreviewTarget(target, 'manual')

    expect($activeRightWorkspaceTab.get()?.target).toEqual(withRenderMode(target, 'source'))
    expect($previewTarget.get()).toEqual(withRenderMode(preview, 'preview'))
    expect(getSessionPreviewRecord('session-1')).toBeNull()

    dismissPreviewTarget()

    expect($activeRightWorkspaceTab.get()?.target).toEqual(withRenderMode(target, 'source'))
    expect($previewTarget.get()).toBeNull()
  })

  it('opens explicit HTML preview links in Browser', () => {
    const target = previewTarget('/work/from-chat.html')

    setCurrentSessionPreviewTarget(target, 'explicit-link')

    expect($activeRightWorkspaceTab.get()).toMatchObject({ kind: 'browser', url: 'file:///work/from-chat.html' })
    expect($previewTarget.get()).toEqual(withRenderMode(target, 'preview'))
    expect(getSessionPreviewRecord('session-1')).toBeNull()
  })

  it('opens artifact HTML files in Browser', () => {
    const target = previewTarget('/work/artifact.html')

    setCurrentSessionPreviewTarget(target, 'artifact')

    expect($activeRightWorkspaceTab.get()).toMatchObject({ kind: 'browser', url: 'file:///work/artifact.html' })
    expect($previewTarget.get()).toEqual(withRenderMode(target, 'preview'))
    expect(getSessionPreviewRecord('session-1')).toBeNull()
  })

  it('keeps file tabs when a live preview opens', () => {
    const file = previewTarget('/work/file.html')
    const live = previewTarget('/work/live.html')

    setCurrentSessionPreviewTarget(file, 'manual')
    setCurrentSessionPreviewTarget(live, 'tool-result')

    expect($rightWorkspaceTabs.get()).toMatchObject([
      { kind: 'files', target: withRenderMode(file, 'source') },
      { kind: 'browser', url: 'file:///work/live.html' }
    ])
    expect($activeRightWorkspaceTab.get()).toMatchObject({ kind: 'browser', url: 'file:///work/live.html' })
    expect($previewTarget.get()).toEqual(withRenderMode(live, 'preview'))
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import {
  $activeRightWorkspaceTabId,
  $rightWorkspaceSizeMode,
  $rightWorkspaceTabs,
  closeEphemeralRightWorkspaceTabsForTarget,
  openBrowserWorkspace,
  openFilesWorkspaceTarget,
  openReviewWorkspace,
  openTerminalWorkspaceForTerminal,
  pruneRightWorkspaceTerminalTabs,
  setRightWorkspaceScope,
  toggleRightWorkspaceSize
} from './right-workspace'
import { $paneOpen, setPaneOpen } from './panes'

describe('right workspace session scope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setRightWorkspaceScope(`test-${crypto.randomUUID()}`)
    $rightWorkspaceTabs.set([])
    $activeRightWorkspaceTabId.set(null)
    $rightWorkspaceSizeMode.set('normal')
    setPaneOpen('right-workspace', false)
  })

  it('isolates tabs, active tab, and size mode per session scope', () => {
    setRightWorkspaceScope('session-a')
    openTerminalWorkspaceForTerminal('term-a')
    toggleRightWorkspaceSize()

    setRightWorkspaceScope('session-b')
    openReviewWorkspace()

    expect($rightWorkspaceTabs.get()).toMatchObject([{ id: 'review', kind: 'review' }])
    expect($activeRightWorkspaceTabId.get()).toBe('review')
    expect($rightWorkspaceSizeMode.get()).toBe('normal')

    setRightWorkspaceScope('session-a')

    expect($rightWorkspaceTabs.get()).toMatchObject([{ id: 'terminal:term-a', kind: 'terminal', terminalId: 'term-a' }])
    expect($activeRightWorkspaceTabId.get()).toBe('terminal:term-a')
    expect($rightWorkspaceSizeMode.get()).toBe('expanded')
  })

  it('migrates draft workspace state to the first real session scope', () => {
    setRightWorkspaceScope('draft:local:/repo')
    openTerminalWorkspaceForTerminal('draft-term')

    setRightWorkspaceScope('session-real')

    expect($rightWorkspaceTabs.get()).toMatchObject([
      { id: 'terminal:draft-term', kind: 'terminal', terminalId: 'draft-term' }
    ])
    expect(window.localStorage.getItem('hermes.desktop.rightWorkspace.v1.draft%3Alocal%3A%2Frepo')).toBeNull()
  })

  it('prunes stale terminal tabs with no matching terminal entry', () => {
    openTerminalWorkspaceForTerminal('live-term')
    openTerminalWorkspaceForTerminal('stale-term')

    pruneRightWorkspaceTerminalTabs(['live-term'])

    expect($rightWorkspaceTabs.get()).toMatchObject([{ id: 'terminal:live-term', terminalId: 'live-term' }])
    expect($activeRightWorkspaceTabId.get()).toBe('terminal:live-term')
  })

  it('opens browser tabs as right workspace tabs', () => {
    openBrowserWorkspace('https://example.com/demo')

    expect($rightWorkspaceTabs.get()).toMatchObject([
      { id: 'browser:https://example.com/demo', kind: 'browser', url: 'https://example.com/demo' }
    ])
    expect($activeRightWorkspaceTabId.get()).toBe('browser:https://example.com/demo')
  })

  it('does not force-open the pane for inactive tab updates', () => {
    openBrowserWorkspace('https://example.com/background', false)

    expect($paneOpen('right-workspace').get()).toBe(false)
    expect($activeRightWorkspaceTabId.get()).toBeNull()
  })

  it('keeps file tabs distinct by render mode and source', () => {
    const base = {
      kind: 'file' as const,
      label: 'index.html',
      previewKind: 'html' as const,
      source: '/tmp/index.html',
      url: 'file:///tmp/index.html'
    }

    openFilesWorkspaceTarget({ ...base, renderMode: 'source' })
    openFilesWorkspaceTarget({ ...base, renderMode: 'preview' })

    expect($rightWorkspaceTabs.get().map(tab => tab.id)).toEqual([
      'files:file:file:///tmp/index.html:/tmp/index.html:source:html',
      'files:file:file:///tmp/index.html:/tmp/index.html:preview:html'
    ])
  })

  it('closes only matching ephemeral preview tabs', () => {
    const target = {
      kind: 'file' as const,
      label: 'report.html',
      previewKind: 'html' as const,
      renderMode: 'preview' as const,
      source: '/tmp/report.html',
      url: 'https://gateway/api/preview/file/id/report.html'
    }

    openFilesWorkspaceTarget(target, { ephemeral: true })
    openBrowserWorkspace('https://example.com/manual')

    closeEphemeralRightWorkspaceTabsForTarget(target)

    expect($rightWorkspaceTabs.get()).toMatchObject([{ kind: 'browser', url: 'https://example.com/manual' }])
  })
})

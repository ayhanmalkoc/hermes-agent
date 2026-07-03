import { beforeEach, describe, expect, it } from 'vitest'

import {
  $activeRightWorkspaceTabId,
  $rightWorkspaceSizeMode,
  $rightWorkspaceTabs,
  openReviewWorkspace,
  openTerminalWorkspaceForTerminal,
  setRightWorkspaceScope,
  toggleRightWorkspaceSize
} from './right-workspace'

describe('right workspace session scope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setRightWorkspaceScope(`test-${crypto.randomUUID()}`)
    $rightWorkspaceTabs.set([])
    $activeRightWorkspaceTabId.set(null)
    $rightWorkspaceSizeMode.set('normal')
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
})

import { atom } from 'nanostores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'hermes.desktop.terminals.v1'

async function loadTerminalStore() {
  vi.doMock('@/store/session', () => ({
    $connection: atom(null),
    $currentCwd: atom('/workspace')
  }))

  return import('./terminals')
}

describe('terminal store persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('restores user tabs, active tab, and history on module load', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeTerminalId: 'term-two',
        terminals: [
          { auto: false, cwd: '/repo/one', id: 'term-one', reviveBuffer: 'last output', title: 'zsh' },
          { auto: true, cwd: '/repo/two', id: 'term-two', title: 'Terminal' }
        ]
      })
    )

    const { $activeTerminalId, $terminals } = await loadTerminalStore()

    expect($activeTerminalId.get()).toBe('term-two')
    expect($terminals.get()).toEqual([
      { auto: false, cwd: '/repo/one', id: 'term-one', kind: 'user', reviveBuffer: 'last output', scopeKey: 'global', title: 'zsh' },
      { auto: true, cwd: '/repo/two', id: 'term-two', kind: 'user', scopeKey: 'global', title: 'Terminal' }
    ])
  })

  it('persists terminals independently per session scope without dropping live tabs', async () => {
    const { $activeTerminalId, $terminals, createTerminal, setTerminalScope } = await loadTerminalStore()

    setTerminalScope('session-a')
    const firstId = createTerminal('/repo/a')
    setTerminalScope('session-b')
    const secondId = createTerminal('/repo/b')

    expect($activeTerminalId.get()).toBe(secondId)
    expect($terminals.get().map(term => [term.id, term.scopeKey])).toEqual([
      [firstId, 'session-a'],
      [secondId, 'session-b']
    ])
    expect(window.localStorage.getItem(`${STORAGE_KEY}.scope.session-a`)).toContain('/repo/a')
    expect(window.localStorage.getItem(`${STORAGE_KEY}.scope.session-b`)).toContain('/repo/b')

    setTerminalScope('session-a')

    expect($activeTerminalId.get()).toBe(firstId)
  })

  it('promotes draft terminals to the first real session scope', async () => {
    const { $activeTerminalId, $terminals, createTerminal, setTerminalScope } = await loadTerminalStore()

    setTerminalScope('draft:local:/repo')
    const id = createTerminal('/repo')

    setTerminalScope('session-real')

    expect($activeTerminalId.get()).toBe(id)
    expect($terminals.get()).toMatchObject([{ id, scopeKey: 'session-real' }])
    expect(window.localStorage.getItem(`${STORAGE_KEY}.scope.${encodeURIComponent('draft:local:/repo')}`)).toBeNull()
    expect(window.localStorage.getItem(`${STORAGE_KEY}.scope.session-real`)).toContain('/repo')
  })

  it('persists user tabs and history synchronously, skipping agent mirrors', async () => {
    const { createTerminal, ensureAgentTerminal, renameTerminal, selectTerminal, updateTerminalReviveBuffer } =
      await loadTerminalStore()

    const userId = createTerminal('/repo')
    renameTerminal(userId, 'server')
    updateTerminalReviveBuffer(userId, 'recent scrollback')
    ensureAgentTerminal('proc-1', 'background task')
    selectTerminal(userId)

    // No flush/tick: persistence is synchronous, so the snapshot is already on
    // disk (this is what makes app-quit restore reliable).
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      activeTerminalId: userId,
      terminals: [{ auto: false, cwd: '/repo', id: userId, reviveBuffer: 'recent scrollback', title: 'server' }]
    })
  })

  it('never attaches a revive buffer to an agent tab', async () => {
    const { $terminals, ensureAgentTerminal, updateTerminalReviveBuffer } = await loadTerminalStore()

    const agentId = ensureAgentTerminal('proc-1', 'background task')!
    updateTerminalReviveBuffer(agentId, 'should be ignored')

    expect($terminals.get().find(term => term.id === agentId)?.reviveBuffer).toBeUndefined()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('tail-trims an oversized revive buffer to stay under the storage budget', async () => {
    const { $terminals, createTerminal, updateTerminalReviveBuffer } = await loadTerminalStore()

    const userId = createTerminal('/repo')
    const huge = 'x'.repeat(60_000)
    updateTerminalReviveBuffer(userId, huge)

    const stored = $terminals.get().find(term => term.id === userId)?.reviveBuffer ?? ''
    expect(stored.length).toBe(48_000)
    expect(stored).toBe(huge.slice(-48_000))
  })

  it('clears remembered tabs when all terminals close', async () => {
    const { closeAllTerminals, createTerminal } = await loadTerminalStore()

    createTerminal('/repo')
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    closeAllTerminals()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('opens and closes matching right workspace tabs', async () => {
    const { closeTerminal, createAndOpenTerminal } = await loadTerminalStore()
    const { $activeRightWorkspaceTabId, $rightWorkspaceTabs } = await import('@/store/right-workspace')

    const userId = createAndOpenTerminal('/repo')

    expect($rightWorkspaceTabs.get()).toMatchObject([{ id: `terminal:${userId}`, kind: 'terminal', terminalId: userId }])
    expect($activeRightWorkspaceTabId.get()).toBe(`terminal:${userId}`)

    closeTerminal(userId)

    expect($rightWorkspaceTabs.get()).toEqual([])
  })

  it('focuses a newly visible agent terminal tab once', async () => {
    const { createAndOpenTerminal, ensureAgentTerminal } = await loadTerminalStore()
    const { $activeRightWorkspaceTabId, $rightWorkspaceTabs } = await import('@/store/right-workspace')

    const userId = createAndOpenTerminal('/repo')
    const agentId = ensureAgentTerminal('proc-1', 'agent task')!

    expect($rightWorkspaceTabs.get()).toMatchObject([
      { id: `terminal:${userId}`, kind: 'terminal', terminalId: userId },
      { id: `terminal:${agentId}`, kind: 'terminal', terminalId: agentId }
    ])
    expect($activeRightWorkspaceTabId.get()).toBe(`terminal:${agentId}`)

    $activeRightWorkspaceTabId.set(`terminal:${userId}`)

    $rightWorkspaceTabs.set($rightWorkspaceTabs.get().filter(tab => tab.terminalId !== agentId))
    ensureAgentTerminal('proc-1', 'agent task')

    expect($rightWorkspaceTabs.get().some(tab => tab.terminalId === agentId)).toBe(true)
    expect($activeRightWorkspaceTabId.get()).toBe(`terminal:${userId}`)
  })

  it('closes agent terminal tabs by proc id or renderer tab id', async () => {
    const { closeAgentTerminalByProc, ensureAgentTerminal } = await loadTerminalStore()
    const { $rightWorkspaceTabs } = await import('@/store/right-workspace')

    const firstId = ensureAgentTerminal('proc-1', 'agent task')!

    expect(closeAgentTerminalByProc('proc-1')).toBe(true)
    expect($rightWorkspaceTabs.get().some(tab => tab.terminalId === firstId)).toBe(false)

    const secondId = ensureAgentTerminal('proc-2', 'agent task')!

    expect(closeAgentTerminalByProc(secondId)).toBe(true)
    expect($rightWorkspaceTabs.get().some(tab => tab.terminalId === secondId)).toBe(false)
  })

  it('closes finished agent terminal tabs by process id', async () => {
    const { closeFinishedAgentTerminals, ensureAgentTerminal } = await loadTerminalStore()
    const { $rightWorkspaceTabs } = await import('@/store/right-workspace')

    const id = ensureAgentTerminal('proc-done', 'agent task')!

    closeFinishedAgentTerminals(['proc-done'])

    expect($rightWorkspaceTabs.get().some(tab => tab.terminalId === id)).toBe(false)
  })
})

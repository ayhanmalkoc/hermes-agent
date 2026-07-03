import { describe, expect, it, vi } from 'vitest'

import { terminalApiForConnection } from './api'

describe('terminalApiForConnection', () => {
  it('uses the local Electron terminal API for local connections', () => {
    const local = { start: vi.fn() }

    ;(window as unknown as { hermesDesktop: { terminal: unknown } }).hermesDesktop = { terminal: local }

    expect(terminalApiForConnection(null, null)).toBe(local)
  })

  it('uses gateway RPC and events for remote connections', async () => {
    const handlers = new Map<string, (event: { payload?: { data?: string; id?: string } }) => void>()

    const gateway = {
      on: vi.fn((type: string, handler: (event: { payload?: { data?: string; id?: string } }) => void) => {
        handlers.set(type, handler)

        return () => handlers.delete(type)
      }),
      request: vi.fn(async (method: string, params: Record<string, unknown>) => ({ method, params }))
    }

    const api = terminalApiForConnection({ baseUrl: 'https://backend', mode: 'remote' } as never, gateway as never)!
    const onData = vi.fn()
    api.onData('term-1', onData)

    await api.start({ cols: 120, cwd: '/srv/app', rows: 40 })
    await api.write('term-1', 'pwd\r')
    handlers.get('desktop_terminal.data')?.({ payload: { data: '/srv/app', id: 'term-1' } })
    handlers.get('desktop_terminal.data')?.({ payload: { data: 'wrong', id: 'term-2' } })

    expect(gateway.request).toHaveBeenCalledWith('desktop_terminal.start', { cols: 120, cwd: '/srv/app', rows: 40 })
    expect(gateway.request).toHaveBeenCalledWith('desktop_terminal.write', { data: 'pwd\r', id: 'term-1' })
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith('/srv/app')
  })
})

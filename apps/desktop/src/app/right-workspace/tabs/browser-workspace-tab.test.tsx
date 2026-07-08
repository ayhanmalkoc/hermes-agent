import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $rightWorkspaceTabs } from '@/store/right-workspace'

import { BrowserWorkspaceTab } from './browser-workspace-tab'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('BrowserWorkspaceTab', () => {
  beforeEach(() => {
    $rightWorkspaceTabs.set([])
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('syncs URL, loading, and navigation state from the BrowserView', async () => {
    let onState: ((payload: { canGoBack?: boolean; canGoForward?: boolean; id: string; loading?: boolean; title?: string; url?: string }) => void) | null = null
    const browser = {
      back: vi.fn(async () => ({ ok: true })),
      forward: vi.fn(async () => ({ ok: true })),
      hide: vi.fn(async () => ({ ok: true })),
      load: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      onState: vi.fn((_id: string, callback: typeof onState) => {
        onState = callback
        return vi.fn()
      }),
      reload: vi.fn(async () => ({ ok: true })),
      setBounds: vi.fn(async () => ({ ok: true })),
      show: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      stop: vi.fn(async () => ({ ok: true }))
    }

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: { browser, openExternal: vi.fn() }
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0)
      return 1
    })

    render(
      <BrowserWorkspaceTab
        tab={{
          createdAt: 1,
          id: 'browser:https://example.com',
          kind: 'browser',
          lastActiveAt: 1,
          title: 'Browser',
          url: 'https://example.com'
        }}
      />
    )

    expect(browser.show).toHaveBeenCalledWith('browser:https://example.com', 'https://example.com/')

    act(() => {
      onState?.({
        canGoBack: true,
        canGoForward: true,
        id: 'browser:https://example.com',
        loading: false,
        title: 'Next page',
        url: 'https://example.com/next'
      })
    })

    expect((screen.getByLabelText('Browser URL') as HTMLInputElement).value).toBe('https://example.com/next')
    expect(screen.getByLabelText('Back').hasAttribute('disabled')).toBe(false)
    expect(screen.getByLabelText('Forward').hasAttribute('disabled')).toBe(false)
  })
})

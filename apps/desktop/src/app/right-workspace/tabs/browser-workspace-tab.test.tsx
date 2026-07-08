import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $rightWorkspaceTabs } from '@/store/right-workspace'

import { BrowserWorkspaceTab } from './browser-workspace-tab'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('BrowserWorkspaceTab', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

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
      setVisible: vi.fn(async () => ({ ok: true })),
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
    expect(browser.show).toHaveBeenCalledTimes(1)
  })

  it('loads typed URLs once and accepts redirected observed URLs without reloading', async () => {
    let onState: ((payload: { canGoBack?: boolean; canGoForward?: boolean; id: string; loading?: boolean; title?: string; url?: string }) => void) | null = null
    const browser = {
      back: vi.fn(async () => ({ ok: true })),
      forward: vi.fn(async () => ({ ok: true })),
      hide: vi.fn(async () => ({ ok: true })),
      load: vi.fn(async (_id: string, _url: string) => ({ ok: true, url: 'https://www.google.com/' })),
      onState: vi.fn((_id: string, callback: typeof onState) => {
        onState = callback
        return vi.fn()
      }),
      reload: vi.fn(async () => ({ ok: true })),
      setBounds: vi.fn(async () => ({ ok: true })),
      setVisible: vi.fn(async () => ({ ok: true })),
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
          id: 'browser',
          kind: 'browser',
          lastActiveAt: 1,
          title: 'Browser',
          url: ''
        }}
      />
    )

    const input = screen.getByLabelText('Browser URL') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'google.com' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(browser.load).toHaveBeenCalledWith('browser', 'https://google.com/'))

    act(() => {
      onState?.({ id: 'browser', loading: true, url: 'https://old.example/' })
      onState?.({ id: 'browser', loading: false, title: 'Google', url: 'https://www.google.com/' })
    })

    expect((screen.getByLabelText('Browser URL') as HTMLInputElement).value).toBe('https://www.google.com/')
    expect(browser.load).toHaveBeenCalledTimes(1)
    expect(browser.show).not.toHaveBeenCalled()
  })

  it('opens a blank browser without loading example.com', async () => {
    const browser = {
      back: vi.fn(async () => ({ ok: true })),
      forward: vi.fn(async () => ({ ok: true })),
      hide: vi.fn(async () => ({ ok: true })),
      load: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      onState: vi.fn(() => vi.fn()),
      reload: vi.fn(async () => ({ ok: true })),
      setBounds: vi.fn(async () => ({ ok: true })),
      setVisible: vi.fn(async () => ({ ok: true })),
      show: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      stop: vi.fn(async () => ({ ok: true }))
    }

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: { browser, openExternal: vi.fn() }
    })

    render(
      <BrowserWorkspaceTab
        tab={{
          createdAt: 1,
          id: 'browser',
          kind: 'browser',
          lastActiveAt: 1,
          title: 'Browser',
          url: ''
        }}
      />
    )

    expect((screen.getByLabelText('Browser URL') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Blank browser')).toBeTruthy()
    await waitFor(() => expect(browser.hide).toHaveBeenCalledWith('browser'))
    expect(browser.show).not.toHaveBeenCalled()
    expect(browser.load).not.toHaveBeenCalled()
  })
})

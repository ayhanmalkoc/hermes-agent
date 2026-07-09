import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $activeRightWorkspaceTabId,
  $rightWorkspaceTabs,
  type RightWorkspaceTab
} from '@/store/right-workspace'

import { RightWorkspace } from './index'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

function browserTab(): RightWorkspaceTab {
  return {
    createdAt: 1,
    id: 'browser:https://example.com',
    kind: 'browser',
    lastActiveAt: 1,
    title: 'Browser',
    url: 'https://example.com'
  }
}

function reviewTab(): RightWorkspaceTab {
  return {
    createdAt: 1,
    id: 'review',
    kind: 'review',
    lastActiveAt: 1,
    title: 'Review'
  }
}

describe('RightWorkspace new tab menu', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    $rightWorkspaceTabs.set([])
    $activeRightWorkspaceTabId.set(null)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('uses the native menu when the active tab is browser', async () => {
    const tab = browserTab()
    const showNewTabMenu = vi.fn(async () => 'files')
    const browser = {
      back: vi.fn(async () => ({ ok: true })),
      forward: vi.fn(async () => ({ ok: true })),
      hide: vi.fn(async () => ({ ok: true })),
      load: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      onState: vi.fn(() => vi.fn()),
      reload: vi.fn(async () => ({ ok: true })),
      setBounds: vi.fn(async () => ({ ok: true })),
      show: vi.fn(async (_id: string, url: string) => ({ ok: true, url })),
      stop: vi.fn(async () => ({ ok: true }))
    }

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: { browser, openExternal: vi.fn(), rightWorkspace: { showNewTabMenu } }
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0)
      return 1
    })

    $rightWorkspaceTabs.set([tab])
    $activeRightWorkspaceTabId.set(tab.id)

    render(<RightWorkspace />)
    fireEvent.click(screen.getByLabelText('New tab'))

    await waitFor(() => expect(showNewTabMenu).toHaveBeenCalledWith([
      { hint: 'Ctrl+Shift+G', icon: 'diff', kind: 'review', label: 'Review' },
      { icon: 'terminal', kind: 'terminal', label: 'Terminal' },
      { icon: 'globe', kind: 'browser', label: 'Browser' },
      { hint: 'Ctrl+P', icon: 'folder-opened', kind: 'files', label: 'Files' }
    ]))
    await waitFor(() => expect($rightWorkspaceTabs.get().some(item => item.kind === 'files')).toBe(true))
  })

  it('keeps the React dropdown when the active tab is not browser', () => {
    const tab = reviewTab()
    const showNewTabMenu = vi.fn(async () => 'files')

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: { rightWorkspace: { showNewTabMenu } }
    })

    $rightWorkspaceTabs.set([tab])
    $activeRightWorkspaceTabId.set(tab.id)

    render(<RightWorkspace />)
    fireEvent.pointerDown(screen.getByLabelText('New tab'))

    expect(showNewTabMenu).not.toHaveBeenCalled()
    expect(screen.getByText('Terminal')).toBeTruthy()
    expect(screen.getByText('Browser')).toBeTruthy()
    expect(screen.getByText('Files')).toBeTruthy()
  })
})

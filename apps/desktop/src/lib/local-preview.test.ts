import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $connection } from '@/store/session'

import { localPreviewTarget, normalizeOrLocalPreviewTarget } from './local-preview'

describe('localPreviewTarget', () => {
  beforeEach(() => {
    $connection.set({ mode: 'local' } as never)
    vi.restoreAllMocks()
  })

  it('keeps localhost URLs local in local mode', () => {
    expect(localPreviewTarget('http://localhost:5173/demo')?.url).toBe('http://localhost:5173/demo')
  })

  it('uses fresh gateway preview tickets for remote localhost URLs', async () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://100.107.234.45:9119', token: 't' } as never)
    vi.stubGlobal('window', {
      hermesDesktop: {
        api: vi.fn(async () => ({ url: '/api/preview/open/ticket/demo' }))
      }
    })

    expect((await normalizeOrLocalPreviewTarget('http://localhost:5173/demo'))?.url).toBe(
      'https://100.107.234.45:9119/api/preview/open/ticket/demo'
    )
  })

  it('does not leak remote file previews as local file URLs', () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://gw', token: 't' } as never)

    const target = localPreviewTarget('/var/lib/hermes/out.html')

    expect(target?.renderMode).toBe('source')
    expect(target?.url).toBe('https://gw/api/files/download?path=%2Fvar%2Flib%2Fhermes%2Fout.html&token=t')
  })

  it('turns remote HTML file previews into browser-safe data URLs', async () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://gw', token: 't' } as never)
    vi.stubGlobal('window', {
      hermesDesktop: {
        api: vi.fn(async () => ({ binary: false, byteSize: 12, language: 'html', mimeType: 'text/html', text: '<h1>OK</h1>' }))
      }
    })

    const target = await normalizeOrLocalPreviewTarget('/var/lib/hermes/out.html')

    expect(target?.previewKind).toBe('html')
    expect(target?.url).toBe('data:text/html;charset=utf-8,%3Ch1%3EOK%3C%2Fh1%3E')
  })

  it('turns local HTML file previews into browser-safe data URLs', async () => {
    vi.stubGlobal('window', {
      hermesDesktop: {
        normalizePreviewTarget: vi.fn(async () => ({
          kind: 'file',
          label: 'out.html',
          language: 'html',
          path: '/tmp/out.html',
          previewKind: 'html',
          source: '/tmp/out.html',
          url: 'file:///tmp/out.html'
        })),
        readFileText: vi.fn(async () => ({ binary: false, byteSize: 12, language: 'html', mimeType: 'text/html', text: '<h1>OK</h1>' }))
      }
    })

    const target = await normalizeOrLocalPreviewTarget('/tmp/out.html')

    expect(target?.url).toBe('data:text/html;charset=utf-8,%3Ch1%3EOK%3C%2Fh1%3E')
  })
})

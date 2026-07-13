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

  it('uses the remote preview resolver for remote localhost URLs', async () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://100.107.234.45:9119', token: 't' } as never)
    const api = vi.fn(async () => ({ kind: 'proxy', label: 'demo', url: '/api/preview/proxy/signed/demo' }))
    vi.stubGlobal('window', {
      hermesDesktop: {
        api
      }
    })

    expect((await normalizeOrLocalPreviewTarget('http://localhost:5173/demo'))?.url).toBe(
      'https://100.107.234.45:9119/api/preview/proxy/signed/demo'
    )
    expect(api).toHaveBeenCalledWith({
      body: { cwd: undefined, target: 'http://localhost:5173/demo' },
      method: 'POST',
      path: '/api/preview/resolve'
    })
  })

  it('lets the remote resolver map localhost HTML URLs to file previews when cwd matches', async () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://gw', token: 't' } as never)
    const api = vi.fn(async () => ({
      kind: 'file',
      label: 'index.html',
      mime_type: 'text/html',
      path: '/var/lib/hermes/hermes-2/hermes-remote-preview-launch/index.html',
      url: '/api/preview/file/signed/index.html'
    }))
    vi.stubGlobal('window', {
      hermesDesktop: {
        api
      }
    })

    const target = await normalizeOrLocalPreviewTarget(
      'http://127.0.0.1:8731/index.html',
      '/var/lib/hermes/hermes-2/hermes-remote-preview-launch'
    )

    expect(target).toMatchObject({
      kind: 'file',
      path: '/var/lib/hermes/hermes-2/hermes-remote-preview-launch/index.html',
      previewKind: 'html',
      url: 'https://gw/api/preview/file/signed/index.html'
    })
    expect(api).toHaveBeenCalledWith({
      body: {
        cwd: '/var/lib/hermes/hermes-2/hermes-remote-preview-launch',
        target: 'http://127.0.0.1:8731/index.html'
      },
      method: 'POST',
      path: '/api/preview/resolve'
    })
  })

  it('does not leak remote file previews as local file URLs', () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://gw', token: 't' } as never)

    const target = localPreviewTarget('/var/lib/hermes/out.html')

    expect(target?.renderMode).toBe('source')
    expect(target?.url).toBe('https://gw/api/files/download?path=%2Fvar%2Flib%2Fhermes%2Fout.html&token=t')
  })

  it('resolves remote HTML file previews to dashboard-served preview URLs', async () => {
    $connection.set({ mode: 'remote', baseUrl: 'https://gw', token: 't' } as never)
    vi.stubGlobal('window', {
      hermesDesktop: {
        api: vi.fn(async () => ({
          kind: 'file',
          label: 'out.html',
          mime_type: 'text/html',
          path: '/var/lib/hermes/out.html',
          url: '/api/preview/file/signed/out.html'
        }))
      }
    })

    const target = await normalizeOrLocalPreviewTarget('/var/lib/hermes/out.html')

    expect(target?.previewKind).toBe('html')
    expect(target?.url).toBe('https://gw/api/preview/file/signed/out.html')
  })

  it('keeps local HTML file previews on safe file URLs', async () => {
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

    expect(target?.url).toBe('file:///tmp/out.html')
  })
})

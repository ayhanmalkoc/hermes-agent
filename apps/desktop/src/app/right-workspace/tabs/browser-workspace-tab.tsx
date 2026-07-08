import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { updateRightWorkspaceTab, type RightWorkspaceTab } from '@/store/right-workspace'

const BLANK_BROWSER_URL = 'about:blank'

function normalizeHttpUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function normalizeBrowserTargetUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw || raw === BLANK_BROWSER_URL) return null
  if (/^file:\/\//i.test(raw)) return raw
  return normalizeHttpUrl(raw)
}

export function BrowserWorkspaceTab({ tab }: { tab: RightWorkspaceTab }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const committedUrl = tab.url || ''
  const [draftUrl, setDraftUrl] = useState(committedUrl)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const currentUrl = useMemo(() => normalizeBrowserTargetUrl(committedUrl), [committedUrl])

  useEffect(() => {
    setDraftUrl(tab.url || '')
    setError(null)
    setLoading(false)
    setCanGoBack(false)
    setCanGoForward(false)
  }, [tab.id, tab.url])

  useEffect(() => {
    const api = window.hermesDesktop?.browser
    const element = containerRef.current
    if (!api || !element) return

    let disposed = false
    let frame = 0

    const syncBounds = () => {
      if (disposed || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      void api.setBounds(tab.id, {
        height: Math.max(0, Math.round(rect.height)),
        width: Math.max(0, Math.round(rect.width)),
        x: Math.round(rect.left),
        y: Math.round(rect.top)
      })
    }

    const scheduleBounds = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(syncBounds)
    }

    setError(null)
    if (!currentUrl) {
      setLoading(false)
      setCanGoBack(false)
      setCanGoForward(false)
      void api.hide(tab.id).catch(() => undefined)
      return
    }

    const unsubscribe = api.onState?.(tab.id, payload => {
      if (typeof payload.url === 'string' && payload.url && payload.url !== BLANK_BROWSER_URL) {
        setDraftUrl(payload.url)
        updateRightWorkspaceTab(tab.id, { url: payload.url, title: payload.title || payload.url })
      } else if (payload.title) {
        updateRightWorkspaceTab(tab.id, { title: payload.title })
      }
      if (typeof payload.loading === 'boolean') setLoading(payload.loading)
      if (typeof payload.canGoBack === 'boolean') setCanGoBack(payload.canGoBack)
      if (typeof payload.canGoForward === 'boolean') setCanGoForward(payload.canGoForward)
      if (payload.error !== undefined) setError(payload.error || null)
    })

    void api.show(tab.id, currentUrl).then(() => {
      if (!disposed) {
        setError(null)
        scheduleBounds()
      }
    }).catch(err => setError(err instanceof Error ? err.message : String(err)))

    const observer = new ResizeObserver(scheduleBounds)
    observer.observe(element)
    window.addEventListener('resize', scheduleBounds)
    scheduleBounds()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleBounds)
      unsubscribe?.()
      void api.hide(tab.id).catch(() => undefined)
    }
  }, [currentUrl, tab.id])

  const load = (value = draftUrl) => {
    const raw = value.trim()
    if (!raw || raw === BLANK_BROWSER_URL) {
      setDraftUrl('')
      setError(null)
      setLoading(false)
      updateRightWorkspaceTab(tab.id, { title: 'Browser', url: '' })
      void window.hermesDesktop?.browser.hide(tab.id).catch(() => undefined)
      return
    }

    const next = normalizeBrowserTargetUrl(raw)
    if (!next) {
      setError('Only http://, https://, and safe file preview URLs are supported.')
      return
    }

    setError(null)
    setLoading(true)
    setDraftUrl(next)
    updateRightWorkspaceTab(tab.id, { title: 'Browser', url: next })
    void window.hermesDesktop?.browser.load(tab.id, next).catch(err => setError(err instanceof Error ? err.message : String(err))).finally(() => setLoading(false))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--ui-editor-surface-background)">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-(--ui-stroke-quaternary) px-2">
        <Tip label="Back"><Button aria-label="Back" className="h-7 w-7" disabled={!canGoBack} onClick={() => void window.hermesDesktop?.browser.back(tab.id)} size="icon-xs" variant="ghost"><Codicon name="arrow-left" size="0.85rem" /></Button></Tip>
        <Tip label="Forward"><Button aria-label="Forward" className="h-7 w-7" disabled={!canGoForward} onClick={() => void window.hermesDesktop?.browser.forward(tab.id)} size="icon-xs" variant="ghost"><Codicon name="arrow-right" size="0.85rem" /></Button></Tip>
        <Tip label={loading ? 'Stop' : 'Reload'}>
          <Button aria-label={loading ? 'Stop' : 'Reload'} className="h-7 w-7" disabled={!currentUrl} onClick={() => void (loading ? window.hermesDesktop?.browser.stop(tab.id) : window.hermesDesktop?.browser.reload(tab.id))} size="icon-xs" variant="ghost">
            <Codicon name={loading ? 'debug-stop' : 'refresh'} size="0.85rem" />
          </Button>
        </Tip>
        <form className="min-w-0 flex-1" onSubmit={event => { event.preventDefault(); load() }}>
          <input
            aria-label="Browser URL"
            className="h-7 w-full rounded-lg border border-(--ui-stroke-quaternary) bg-(--ui-input-background) px-2 text-xs text-(--ui-text-primary) outline-none focus:border-(--ui-stroke-secondary)"
            onChange={event => setDraftUrl(event.target.value)}
            spellCheck={false}
            value={draftUrl}
          />
        </form>
        <Tip label="Open external"><Button aria-label="Open external" className="h-7 w-7" disabled={!currentUrl} onClick={() => { if (currentUrl) void window.hermesDesktop?.openExternal(currentUrl) }} size="icon-xs" variant="ghost"><Codicon name="link-external" size="0.85rem" /></Button></Tip>
      </div>
      {error && <div className="border-b border-(--ui-stroke-quaternary) px-3 py-1.5 text-xs text-red-400">{error}</div>}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-(--ui-editor-surface-background)">
        {!currentUrl && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="max-w-sm rounded-2xl border border-(--ui-stroke-quaternary) bg-(--ui-sidebar-surface-background)/70 px-6 py-5 shadow-sm">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-(--ui-stroke-quaternary) bg-(--ui-editor-surface-background)">
                <Codicon name="globe" size="1.1rem" />
              </div>
              <div className="text-sm font-medium text-(--ui-text-primary)">Blank browser</div>
              <div className="mt-1 text-xs text-muted-foreground">Enter a URL above to open it here.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

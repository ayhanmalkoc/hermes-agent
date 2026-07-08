import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { FileText, MonitorPlay } from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { previewName } from '@/lib/preview-targets'
import { notifyError } from '@/store/notifications'
import {
  $previewTarget,
  dismissPreviewTarget,
  type PreviewRecordSource,
  setCurrentSessionPreviewTarget
} from '@/store/preview'
import { $currentCwd } from '@/store/session'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface PreviewOpenState {
  openTarget: (target: string) => Promise<void>
  openingTarget: string | null
}

function usePreviewOpen(source: PreviewRecordSource | ((target: string) => PreviewRecordSource)): PreviewOpenState {
  const { t } = useI18n()
  const cwd = useStore($currentCwd)
  const activePreview = useStore($previewTarget)
  const [openingTarget, setOpeningTarget] = useState<string | null>(null)
  const activePreviewRef = useRef(activePreview)
  const cwdRef = useRef(cwd)
  const mountedRef = useRef(false)
  const requestTokenRef = useRef(0)

  activePreviewRef.current = activePreview
  cwdRef.current = cwd

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    requestTokenRef.current += 1
    setOpeningTarget(null)
  }, [cwd])

  async function openTarget(target: string) {
    if (openingTarget) {
      return
    }

    const current = activePreviewRef.current

    if (current?.source === target) {
      dismissPreviewTarget()

      return
    }

    const requestToken = ++requestTokenRef.current
    const requestCwd = cwdRef.current

    setOpeningTarget(target)

    try {
      const preview = await normalizeOrLocalPreviewTarget(target, requestCwd || undefined)

      if (!mountedRef.current || requestTokenRef.current !== requestToken || cwdRef.current !== requestCwd) {
        return
      }

      if (!preview) {
        throw new Error(`Could not open preview target: ${target}`)
      }

      const latest = activePreviewRef.current

      if (latest?.source === preview.source && latest.url === preview.url) {
        return
      }

      const previewSource = typeof source === 'function' ? source(target) : source

      setCurrentSessionPreviewTarget(preview, previewSource, target)
    } catch (error) {
      if (!mountedRef.current || requestTokenRef.current !== requestToken || cwdRef.current !== requestCwd) {
        return
      }

      notifyError(error, t.preview.unavailable)
    } finally {
      if (mountedRef.current && requestTokenRef.current === requestToken) {
        setOpeningTarget(null)
      }
    }
  }

  return { openTarget, openingTarget }
}

export function PreviewAttachment({
  openLabel = 'Open in Browser',
  source = 'manual',
  target
}: {
  openLabel?: string
  source?: PreviewRecordSource
  target: string
}) {
  const { t } = useI18n()
  const activePreview = useStore($previewTarget)
  const { openTarget, openingTarget } = usePreviewOpen(source)
  const name = previewName(target)
  const isActive = activePreview?.source === target
  const opening = openingTarget === target

  return (
    <div className="flex w-full max-w-160 items-center gap-2 rounded-lg border border-border/55 bg-card/55 px-2.5 py-1.5 text-sm">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted/55 text-muted-foreground/85">
        <MonitorPlay className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium text-foreground/90" title={target}>
        {name}
      </span>
      <button
        className="shrink-0 rounded-md border border-border/55 bg-background/40 px-2 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground disabled:opacity-50"
        disabled={opening}
        onClick={() => void openTarget(target)}
        type="button"
      >
        {opening ? t.preview.opening : isActive ? t.preview.hide : openLabel}
      </button>
    </div>
  )
}

function fileActionOpenLabel(target: string): string {
  return /\.html?(?:[?#].*)?$/i.test(target) ? 'Open in Browser' : 'Open in Files'
}

function fileActionPreviewSource(target: string): PreviewRecordSource {
  return /\.html?(?:[?#].*)?$/i.test(target) ? 'artifact' : 'manual'
}

export function FileActionAttachment({ target }: { target: string }) {
  return <PreviewAttachment openLabel={fileActionOpenLabel(target)} source={fileActionPreviewSource(target)} target={target} />
}

export function PreviewGroupAttachment({
  source = 'manual',
  targets
}: {
  source?: PreviewRecordSource
  targets: string[]
}) {
  const { t } = useI18n()
  const activePreview = useStore($previewTarget)
  const { openTarget, openingTarget } = usePreviewOpen(source)
  const activeTarget = targets.find(target => activePreview?.source === target)
  const selectedLabel = activeTarget ? previewName(activeTarget) : `${targets.length} links`

  return (
    <div className="flex w-full max-w-160 items-center gap-2 rounded-xl border border-border/55 bg-card/55 px-2.5 py-2 text-sm shadow-[0_0.0625rem_0.125rem_color-mix(in_srgb,#000_4%,transparent)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/55 text-muted-foreground/85">
        <MonitorPlay className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.82rem] font-semibold text-foreground/90">Browser links</span>
        <span className="block truncate text-[0.7rem] text-muted-foreground">{selectedLabel}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 rounded-lg border border-border/55 bg-background/40 px-2.5 py-1.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground focus:outline-none disabled:opacity-50"
            disabled={Boolean(openingTarget)}
            type="button"
          >
            {openingTarget ? t.preview.opening : 'Open in Browser ▾'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {targets.map(target => {
            const name = previewName(target)

            return (
              <DropdownMenuItem key={target} onClick={() => void openTarget(target)}>
                <span className="min-w-0">
                  <span className="block truncate text-[0.78rem] font-medium">{name}</span>
                  <span className="block truncate text-[0.68rem] text-muted-foreground">{target}</span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function FileActionGroupAttachment({ targets }: { targets: string[] }) {
  const { t } = useI18n()
  const activePreview = useStore($previewTarget)
  const { openTarget, openingTarget } = usePreviewOpen(fileActionPreviewSource)
  const activeTarget = targets.find(target => activePreview?.source === target)
  const selectedLabel = activeTarget ? previewName(activeTarget) : `${targets.length} files`

  return (
    <div className="flex w-full max-w-160 items-center gap-2 rounded-xl border border-border/55 bg-card/55 px-2.5 py-2 text-sm shadow-[0_0.0625rem_0.125rem_color-mix(in_srgb,#000_4%,transparent)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/55 text-muted-foreground/85">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.82rem] font-semibold text-foreground/90">Files</span>
        <span className="block truncate text-[0.7rem] text-muted-foreground">{selectedLabel}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 rounded-lg border border-border/55 bg-background/40 px-2.5 py-1.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground focus:outline-none disabled:opacity-50"
            disabled={Boolean(openingTarget)}
            type="button"
          >
            {openingTarget ? t.preview.opening : 'Open ▾'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {targets.map(target => {
            const name = previewName(target)

            return (
              <DropdownMenuItem key={target} onClick={() => void openTarget(target)}>
                <span className="min-w-0">
                  <span className="block truncate text-[0.78rem] font-medium">{name}</span>
                  <span className="block truncate text-[0.68rem] text-muted-foreground">{fileActionOpenLabel(target)}</span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

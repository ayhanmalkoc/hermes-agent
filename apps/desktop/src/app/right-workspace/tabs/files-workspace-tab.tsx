import { useStore } from '@nanostores/react'

import { PreviewPane } from '@/app/chat/right-rail/preview-pane'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { cn } from '@/lib/utils'
import { $currentCwd } from '@/store/session'
import { toggleRightWorkspaceTabTree, updateRightWorkspaceTab, type RightWorkspaceTab } from '@/store/right-workspace'

import { ProjectTree } from '../../right-sidebar/files/tree'
import { useProjectTree } from '../../right-sidebar/files/use-project-tree'

function breadcrumbFor(cwd: string, source: string | undefined): string {
  if (!source) {
    return '/'
  }

  const cleanCwd = cwd.replace(/[\\/]+$/, '')
  const cleanSource = source.replace(/[\\/]+$/, '')
  const relative = cleanSource.startsWith(cleanCwd) ? cleanSource.slice(cleanCwd.length).replace(/^[\\/]+/, '') : cleanSource
  const parts = relative.split(/[\\/]+/).filter(Boolean)

  return parts.length ? ['hermes-agent', ...parts].join(' › ') : '/'
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard?.writeText(value)
}

function FilesEmptyState() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-2 text-(--ui-text-tertiary)">
        <Codicon name="folder-opened" size="2rem" />
        <div className="text-sm font-medium text-(--ui-text-primary)">Dosya aç</div>
        <div className="text-xs">Çalışma alanı ağacından bir dosya seç</div>
      </div>
    </div>
  )
}

function FilesTreeColumn({ tab }: { tab: RightWorkspaceTab }) {
  const currentCwd = useStore($currentCwd).trim()
  const hasWorkspace = Boolean(currentCwd)
  const {
    collapseNonce,
    data,
    effectiveCwd,
    loadChildren,
    openState,
    rootLoading,
    setNodeOpen
  } = useProjectTree(hasWorkspace ? currentCwd : '')

  const previewFile = async (path: string) => {
    const preview = await normalizeOrLocalPreviewTarget(path, effectiveCwd || undefined)

    if (!preview) {
      return
    }

    updateRightWorkspaceTab(tab.id, {
      selectedPath: path,
      target: preview,
      title: path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Dosya aç'
    })
  }

  return (
    <div className="flex min-h-0 w-[15rem] shrink-0 flex-col border-l border-(--ui-stroke-quaternary) bg-(--ui-sidebar-surface-background)">
      <div className="p-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-(--ui-stroke-quaternary) bg-(--ui-editor-surface-background) px-2 text-xs text-muted-foreground">
          <Codicon name="search" size="0.85rem" />
          Dosyaları filtrele...
        </div>
      </div>
      <ProjectTree
        collapseNonce={collapseNonce}
        cwd={effectiveCwd}
        data={data}
        onActivateFile={() => undefined}
        onActivateFolder={() => undefined}
        onLoadChildren={loadChildren}
        onNodeOpenChange={setNodeOpen}
        onPreviewFile={path => void previewFile(path)}
        openState={openState}
        previewOnSelect
      />
      {rootLoading && <div className="px-3 py-2 text-xs text-muted-foreground">Yükleniyor...</div>}
    </div>
  )
}

export function FilesWorkspaceTab({ tab }: { tab: RightWorkspaceTab }) {
  const currentCwd = useStore($currentCwd).trim()
  const target = tab.target ?? null
  const breadcrumb = breadcrumbFor(currentCwd, tab.selectedPath ?? target?.source)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-(--ui-stroke-quaternary) px-3 text-xs">
        <div className="min-w-0 flex-1 truncate text-(--ui-text-secondary)" title={breadcrumb}>
          {breadcrumb}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Dosya aksiyonları" disabled={!target} size="icon-xs" variant="ghost">
              <Codicon name="ellipsis" size="0.9rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled={!target} onClick={() => target && void copyText(target.source)}>
              <Codicon className="mr-2" name="copy" size="0.875rem" />
              Yolu kopyala
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!target} onClick={() => target && void copyText(target.source)}>
              <Codicon className="mr-2" name="copy" size="0.875rem" />
              Dosya içeriğini kopyala
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateRightWorkspaceTab(tab.id, { richPreviewEnabled: !tab.richPreviewEnabled })}>
              <Codicon className="mr-2" name="code" size="0.875rem" />
              {tab.richPreviewEnabled ? 'Zengin görünümü devre dışı bırak' : 'Zengin görünümü etkinleştir'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button disabled={!target} size="xs" variant="secondary">
          Aç
        </Button>
        <Tip label={tab.treeVisible ? 'Dosyaları gizle' : 'Dosyaları göster'}>
          <Button aria-label={tab.treeVisible ? 'Dosyaları gizle' : 'Dosyaları göster'} onClick={() => toggleRightWorkspaceTabTree(tab.id)} size="icon-xs" variant="ghost">
            <Codicon name="files" size="0.9rem" />
          </Button>
        </Tip>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={cn('min-w-0 flex-1 overflow-hidden', !target && 'flex')}>
          {target ? <PreviewPane embedded richPreviewEnabled={tab.richPreviewEnabled ?? true} target={target} /> : <FilesEmptyState />}
        </div>
        {tab.treeVisible && <FilesTreeColumn tab={tab} />}
      </div>
    </div>
  )
}

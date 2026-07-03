import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { setTerminalTakeover } from '../right-sidebar/store'
import {
  $activeRightWorkspaceTab,
  $rightWorkspaceSizeMode,
  $rightWorkspaceTabs,
  closeRightWorkspaceTab,
  openEmptyFilesWorkspace,
  openReviewWorkspace,
  openTerminalWorkspace,
  selectRightWorkspaceTab,
  toggleRightWorkspaceSize,
  type RightWorkspaceTabKind
} from '@/store/right-workspace'

import { FilesWorkspaceTab } from './tabs/files-workspace-tab'
import { ReviewWorkspaceTab } from './tabs/review-workspace-tab'
import { TerminalWorkspaceTab } from './tabs/terminal-workspace-tab'

function iconFor(kind: RightWorkspaceTabKind): string {
  if (kind === 'review') {
    return 'diff'
  }

  if (kind === 'terminal') {
    return 'terminal'
  }

  return 'folder-opened'
}

function openKind(kind: RightWorkspaceTabKind): void {
  if (kind === 'review') {
    openReviewWorkspace()
  } else if (kind === 'terminal') {
    setTerminalTakeover(true)
    openTerminalWorkspace()
  } else {
    openEmptyFilesWorkspace()
  }
}

function NewTabMenu() {
  const tabs = useStore($rightWorkspaceTabs)
  const reviewOpen = tabs.some(tab => tab.kind === 'review')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Yeni sekme" className="h-7 w-7 rounded-lg" size="icon-xs" variant="ghost">
          <Codicon name="add" size="0.875rem" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {!reviewOpen && (
          <DropdownMenuItem onClick={() => openKind('review')}>
            <Codicon className="mr-2" name="diff" size="0.875rem" />
            <span className="flex-1">İncele</span>
            <span className="text-[0.68rem] text-muted-foreground">Ctrl+Shift+G</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => openKind('terminal')}>
          <Codicon className="mr-2" name="terminal" size="0.875rem" />
          <span className="flex-1">Terminal</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openKind('files')}>
          <Codicon className="mr-2" name="folder-opened" size="0.875rem" />
          <span className="flex-1">Dosyalar</span>
          <span className="text-[0.68rem] text-muted-foreground">Ctrl+P</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RightWorkspaceLauncher() {
  const tabs = useStore($rightWorkspaceTabs)
  const reviewOpen = tabs.some(tab => tab.kind === 'review')
  const items: Array<{ hint?: string; icon: string; kind: RightWorkspaceTabKind; label: string }> = [
    ...(reviewOpen ? [] : [{ hint: 'Ctrl+Shift+G', icon: 'diff', kind: 'review' as const, label: 'İncele' }]),
    { icon: 'terminal', kind: 'terminal', label: 'Terminal' },
    { hint: 'Ctrl+P', icon: 'folder-opened', kind: 'files', label: 'Dosyalar' }
  ]

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-1.5">
        {items.map(item => (
          <button
            className="flex h-10 w-full items-center gap-3 rounded-xl bg-(--ui-sidebar-surface-background) px-3 text-left text-sm text-(--ui-text-secondary) transition hover:bg-(--ui-hover-background) hover:text-(--ui-text-primary)"
            key={item.kind}
            onClick={() => openKind(item.kind)}
            type="button"
          >
            <Codicon name={item.icon} size="0.95rem" />
            <span className="flex-1">{item.label}</span>
            {item.hint && <span className="rounded-md bg-(--ui-surface-muted) px-1.5 py-0.5 text-[0.68rem] text-muted-foreground">{item.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function RightWorkspaceHeader() {
  const tabs = useStore($rightWorkspaceTabs)
  const active = useStore($activeRightWorkspaceTab)
  const sizeMode = useStore($rightWorkspaceSizeMode)

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-(--ui-stroke-quaternary) bg-(--ui-editor-surface-background) px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {tabs.map(tab => (
          <button
            className={cn(
              'group flex h-7 max-w-40 items-center gap-1.5 rounded-lg px-2 text-left text-xs transition',
              active?.id === tab.id
                ? 'bg-(--ui-hover-background) text-(--ui-text-primary)'
                : 'text-(--ui-text-tertiary) hover:bg-(--ui-hover-background) hover:text-(--ui-text-secondary)'
            )}
            key={tab.id}
            onClick={() => selectRightWorkspaceTab(tab.id)}
            title={tab.title}
            type="button"
          >
            <Codicon name={iconFor(tab.kind)} size="0.85rem" />
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
            <span
              className="grid size-4 place-items-center rounded opacity-0 hover:bg-(--ui-hover-background) group-hover:opacity-100"
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                closeRightWorkspaceTab(tab.id)
              }}
              role="button"
              tabIndex={-1}
            >
              <Codicon name="close" size="0.7rem" />
            </span>
          </button>
        ))}
        <NewTabMenu />
      </div>
      <Tip label={sizeMode === 'normal' ? 'Genişlet' : 'Daralt'}>
        <Button aria-label={sizeMode === 'normal' ? 'Genişlet' : 'Daralt'} className="h-7 w-7" onClick={toggleRightWorkspaceSize} size="icon-xs" variant="ghost">
          <Codicon name={sizeMode === 'normal' ? 'screen-full' : 'screen-normal'} size="0.85rem" />
        </Button>
      </Tip>
    </div>
  )
}

function RightWorkspaceContent() {
  const active = useStore($activeRightWorkspaceTab)

  if (!active) {
    return <RightWorkspaceLauncher />
  }

  if (active.kind === 'review') {
    return <ReviewWorkspaceTab tab={active} />
  }

  if (active.kind === 'terminal') {
    return <TerminalWorkspaceTab />
  }

  return <FilesWorkspaceTab tab={active} />
}

export function RightWorkspace() {
  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-(--ui-editor-surface-background) text-(--ui-text-tertiary)">
      <RightWorkspaceHeader />
      <RightWorkspaceContent />
    </aside>
  )
}

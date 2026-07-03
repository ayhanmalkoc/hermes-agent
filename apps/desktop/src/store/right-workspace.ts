import { atom, computed } from 'nanostores'

import type { PreviewTarget } from './preview'
import { ensurePaneRegistered, setPaneOpen, togglePane } from './panes'

export const RIGHT_WORKSPACE_PANE_ID = 'right-workspace'

ensurePaneRegistered(RIGHT_WORKSPACE_PANE_ID, { open: false })

export type RightWorkspaceTabKind = 'files' | 'review' | 'terminal'
export type RightWorkspaceSizeMode = 'normal' | 'expanded'

export interface RightWorkspaceTab {
  id: string
  kind: RightWorkspaceTabKind
  title: string
  target?: PreviewTarget | null
  treeVisible?: boolean
  richPreviewEnabled?: boolean
  wordWrapEnabled?: boolean
  selectedPath?: string | null
  createdAt: number
  lastActiveAt: number
}

export interface OpenRightWorkspaceTabInput {
  kind: RightWorkspaceTabKind
  target?: PreviewTarget | null
  title?: string
}

export const $rightWorkspaceTabs = atom<RightWorkspaceTab[]>([])
export const $activeRightWorkspaceTabId = atom<string | null>(null)
export const $rightWorkspaceSizeMode = atom<RightWorkspaceSizeMode>('normal')
export const $activeRightWorkspaceTab = computed(
  [$rightWorkspaceTabs, $activeRightWorkspaceTabId],
  (tabs, activeId) => tabs.find(tab => tab.id === activeId) ?? null
)

function now(): number {
  return Date.now()
}

function targetTitle(target: PreviewTarget | null | undefined): string {
  if (!target) {
    return 'Dosya aç'
  }

  const label = target.label || target.source || target.url
  const tail = label.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || label || 'Dosya aç'
}

function targetKey(target: PreviewTarget): string {
  return `${target.kind}:${target.url}`
}

function filesTabId(target: PreviewTarget | null | undefined): string {
  return target ? `files:${targetKey(target)}` : 'files:empty'
}

function singletonId(kind: RightWorkspaceTabKind): string {
  return kind
}

function tabIdFor(input: OpenRightWorkspaceTabInput): string {
  if (input.kind === 'files') {
    return filesTabId(input.target)
  }

  return singletonId(input.kind)
}

function defaultTitle(input: OpenRightWorkspaceTabInput): string {
  if (input.title) {
    return input.title
  }

  if (input.kind === 'review') {
    return 'İnceleme'
  }

  if (input.kind === 'terminal') {
    return 'Terminal'
  }

  return targetTitle(input.target)
}

export function setRightWorkspaceOpen(open: boolean): void {
  setPaneOpen(RIGHT_WORKSPACE_PANE_ID, open)
}

export function openRightWorkspaceTab(input: OpenRightWorkspaceTabInput): RightWorkspaceTab {
  const id = tabIdFor(input)
  const timestamp = now()
  const current = $rightWorkspaceTabs.get()
  const existing = current.find(tab => tab.id === id)
  const nextTab: RightWorkspaceTab = {
    createdAt: existing?.createdAt ?? timestamp,
    id,
    kind: input.kind,
    lastActiveAt: timestamp,
    richPreviewEnabled: existing?.richPreviewEnabled ?? true,
    wordWrapEnabled: existing?.wordWrapEnabled ?? true,
    selectedPath: input.target?.source ?? existing?.selectedPath ?? null,
    target: input.kind === 'files' ? (input.target ?? null) : undefined,
    title: defaultTitle(input),
    treeVisible: existing?.treeVisible ?? (input.kind !== 'terminal')
  }

  $rightWorkspaceTabs.set(existing ? current.map(tab => (tab.id === id ? { ...tab, ...nextTab } : tab)) : [...current, nextTab])
  $activeRightWorkspaceTabId.set(id)
  setRightWorkspaceOpen(true)

  return nextTab
}

export function selectRightWorkspaceTab(id: string): void {
  if (!$rightWorkspaceTabs.get().some(tab => tab.id === id)) {
    return
  }

  $activeRightWorkspaceTabId.set(id)
}

export function closeRightWorkspaceTab(id: string): void {
  const current = $rightWorkspaceTabs.get()
  const index = current.findIndex(tab => tab.id === id)

  if (index < 0) {
    return
  }

  const next = current.filter(tab => tab.id !== id)
  $rightWorkspaceTabs.set(next)

  if ($activeRightWorkspaceTabId.get() === id) {
    $activeRightWorkspaceTabId.set((next[index] ?? next[index - 1])?.id ?? null)
  }
}

export function toggleRightWorkspaceSize(): void {
  $rightWorkspaceSizeMode.set($rightWorkspaceSizeMode.get() === 'normal' ? 'expanded' : 'normal')
}

export function updateRightWorkspaceTab(id: string, patch: Partial<RightWorkspaceTab>): void {
  $rightWorkspaceTabs.set($rightWorkspaceTabs.get().map(tab => (tab.id === id ? { ...tab, ...patch } : tab)))
}

export function toggleRightWorkspaceTabTree(id: string): void {
  const tab = $rightWorkspaceTabs.get().find(item => item.id === id)

  if (!tab || tab.kind === 'terminal') {
    return
  }

  updateRightWorkspaceTab(id, { treeVisible: !tab.treeVisible })
}

export function openFilesWorkspaceTarget(target: PreviewTarget): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'files', target })
}

export function openEmptyFilesWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'files', target: null, title: 'Dosya aç' })
}

export function openReviewWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'review' })
}

export function openTerminalWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'terminal' })
}

export function closeActiveRightWorkspaceTab(): void {
  const activeId = $activeRightWorkspaceTabId.get()

  if (activeId) {
    closeRightWorkspaceTab(activeId)
  }
}




export function toggleRightWorkspaceOpen(): void {
  togglePane(RIGHT_WORKSPACE_PANE_ID)
}

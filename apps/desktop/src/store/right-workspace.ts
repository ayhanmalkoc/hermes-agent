import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

import type { PreviewTarget } from './preview'
import { ensurePaneRegistered, setPaneOpen, togglePane } from './panes'

export const RIGHT_WORKSPACE_PANE_ID = 'right-workspace'

ensurePaneRegistered(RIGHT_WORKSPACE_PANE_ID, { open: false })

export type RightWorkspaceTabKind = 'files' | 'review' | 'terminal' | 'browser'
export type RightWorkspaceSizeMode = 'normal' | 'expanded'

export interface RightWorkspaceTab {
  id: string
  kind: RightWorkspaceTabKind
  title: string
  terminalId?: string
  url?: string
  target?: PreviewTarget | null
  treeVisible?: boolean
  richPreviewEnabled?: boolean
  wordWrapEnabled?: boolean
  treeFilter?: string
  selectedPath?: string | null
  createdAt: number
  lastActiveAt: number
}

export interface OpenRightWorkspaceTabInput {
  activate?: boolean
  kind: RightWorkspaceTabKind
  target?: PreviewTarget | null
  terminalId?: string
  title?: string
  url?: string
}

export const $rightWorkspaceTabs = atom<RightWorkspaceTab[]>([])
export const $activeRightWorkspaceTabId = atom<string | null>(null)
export const $rightWorkspaceSizeMode = atom<RightWorkspaceSizeMode>('normal')
export const $activeRightWorkspaceTab = computed(
  [$rightWorkspaceTabs, $activeRightWorkspaceTabId],
  (tabs, activeId) => tabs.find(tab => tab.id === activeId) ?? null
)

interface RightWorkspaceSnapshot {
  activeTabId: string | null
  sizeMode: RightWorkspaceSizeMode
  tabs: RightWorkspaceTab[]
}

const RIGHT_WORKSPACE_STORAGE_KEY = 'hermes.desktop.rightWorkspace.v1'
const DEFAULT_SCOPE_KEY = 'global'

let activeScopeKey = DEFAULT_SCOPE_KEY
let applyingSnapshot = false

function snapshot(): RightWorkspaceSnapshot {
  const tabs = $rightWorkspaceTabs.get()
  const activeTabId = $activeRightWorkspaceTabId.get()

  return {
    activeTabId: activeTabId && tabs.some(tab => tab.id === activeTabId) ? activeTabId : (tabs.at(-1)?.id ?? null),
    sizeMode: $rightWorkspaceSizeMode.get(),
    tabs
  }
}

function storageKey(scopeKey = activeScopeKey): string {
  return `${RIGHT_WORKSPACE_STORAGE_KEY}.${encodeURIComponent(scopeKey || DEFAULT_SCOPE_KEY)}`
}

function persistSnapshot(scopeKey = activeScopeKey): void {
  const next = snapshot()

  if (!next.tabs.length && next.sizeMode === 'normal') {
    writeKey(storageKey(scopeKey), null)
    return
  }

  writeKey(storageKey(scopeKey), JSON.stringify(next))
}

function isRightWorkspaceTab(value: unknown): value is RightWorkspaceTab {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.id === 'string' &&
    (record.kind === 'files' || record.kind === 'review' || record.kind === 'terminal' || record.kind === 'browser') &&
    typeof record.title === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.lastActiveAt === 'number'
  )
}

function loadSnapshot(scopeKey: string): RightWorkspaceSnapshot {
  const raw = readKey(storageKey(scopeKey))

  if (!raw) {
    return { activeTabId: null, sizeMode: 'normal', tabs: [] }
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const tabs = Array.isArray(parsed.tabs) ? parsed.tabs.filter(isRightWorkspaceTab) : []
    const activeTabId =
      typeof parsed.activeTabId === 'string' && tabs.some(tab => tab.id === parsed.activeTabId)
        ? parsed.activeTabId
        : (tabs.at(-1)?.id ?? null)
    const sizeMode = parsed.sizeMode === 'expanded' ? 'expanded' : 'normal'

    return { activeTabId, sizeMode, tabs }
  } catch {
    return { activeTabId: null, sizeMode: 'normal', tabs: [] }
  }
}

function applySnapshot(next: RightWorkspaceSnapshot): void {
  applyingSnapshot = true
  $rightWorkspaceTabs.set(next.tabs)
  $activeRightWorkspaceTabId.set(next.activeTabId)
  $rightWorkspaceSizeMode.set(next.sizeMode)
  applyingSnapshot = false
}

export function pruneRightWorkspaceTerminalTabs(validTerminalIds: readonly string[]): void {
  const valid = new Set(validTerminalIds)
  const current = $rightWorkspaceTabs.get()
  const next = current.filter(tab => tab.kind !== 'terminal' || (tab.terminalId && valid.has(tab.terminalId)))

  if (next.length === current.length) {
    return
  }

  $rightWorkspaceTabs.set(next)

  if ($activeRightWorkspaceTabId.get() && !next.some(tab => tab.id === $activeRightWorkspaceTabId.get())) {
    $activeRightWorkspaceTabId.set(next.at(-1)?.id ?? null)
  }
}

function persistActiveSnapshot(): void {
  if (!applyingSnapshot) {
    persistSnapshot()
  }
}

$rightWorkspaceTabs.subscribe(persistActiveSnapshot)
$activeRightWorkspaceTabId.subscribe(persistActiveSnapshot)
$rightWorkspaceSizeMode.subscribe(persistActiveSnapshot)

export function setRightWorkspaceScope(scopeKey: string, options: { migrateFromScope?: string | null } = {}): void {
  const nextScopeKey = scopeKey || DEFAULT_SCOPE_KEY

  if (nextScopeKey === activeScopeKey) {
    return
  }

  const previousScopeKey = activeScopeKey
  const previousSnapshot = snapshot()

  persistSnapshot(previousScopeKey)
  activeScopeKey = nextScopeKey

  const next = loadSnapshot(nextScopeKey)
  const shouldMigratePrevious =
    !next.tabs.length &&
    !nextScopeKey.startsWith('draft:') &&
    (previousScopeKey.startsWith('draft:') || previousScopeKey === options.migrateFromScope)

  if (shouldMigratePrevious) {
    applySnapshot(previousSnapshot)
    persistSnapshot(nextScopeKey)
    writeKey(storageKey(previousScopeKey), null)
    return
  }

  applySnapshot(next)
}

function now(): number {
  return Date.now()
}

function targetTitle(target: PreviewTarget | null | undefined): string {
  if (!target) {
    return 'Open file'
  }

  const label = target.label || target.source || target.url
  const tail = label.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || label || 'Open file'
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

function terminalTabId(terminalId: string): string {
  return `terminal:${terminalId}`
}

function tabIdFor(input: OpenRightWorkspaceTabInput): string {
  if (input.kind === 'files') {
    return filesTabId(input.target)
  }

  if (input.kind === 'terminal' && input.terminalId) {
    return terminalTabId(input.terminalId)
  }

  if (input.kind === 'browser' && input.url) {
    return `browser:${input.url}`
  }

  return singletonId(input.kind)
}

function defaultTitle(input: OpenRightWorkspaceTabInput): string {
  if (input.title) {
    return input.title
  }

  if (input.kind === 'review') {
    return 'Review'
  }

  if (input.kind === 'terminal') {
    return 'Terminal'
  }

  if (input.kind === 'browser') {
    return input.url || 'Browser'
  }

  return targetTitle(input.target)
}

function buildRightWorkspaceTab(
  input: OpenRightWorkspaceTabInput,
  id: string,
  timestamp: number,
  existing?: RightWorkspaceTab
): RightWorkspaceTab {
  return {
    createdAt: existing?.createdAt ?? timestamp,
    id,
    kind: input.kind,
    lastActiveAt: timestamp,
    richPreviewEnabled: existing?.richPreviewEnabled ?? true,
    wordWrapEnabled: existing?.wordWrapEnabled ?? true,
    treeFilter: existing?.treeFilter ?? '',
    selectedPath: input.target?.source ?? existing?.selectedPath ?? null,
    target: input.kind === 'files' ? (input.target ?? null) : undefined,
    terminalId: input.kind === 'terminal' ? input.terminalId : undefined,
    url: input.kind === 'browser' ? (input.url ?? existing?.url ?? 'https://example.com') : undefined,
    title: defaultTitle(input),
    treeVisible: existing?.treeVisible ?? (input.kind !== 'terminal')
  }
}

export function setRightWorkspaceOpen(open: boolean): void {
  setPaneOpen(RIGHT_WORKSPACE_PANE_ID, open)
}

export function openRightWorkspaceTab(input: OpenRightWorkspaceTabInput): RightWorkspaceTab {
  const id = tabIdFor(input)
  const timestamp = now()
  const current = $rightWorkspaceTabs.get()
  const existing = current.find(tab => tab.id === id)
  const nextTab = buildRightWorkspaceTab(input, id, timestamp, existing)

  $rightWorkspaceTabs.set(existing ? current.map(tab => (tab.id === id ? { ...tab, ...nextTab } : tab)) : [...current, nextTab])

  if (input.activate !== false) {
    $activeRightWorkspaceTabId.set(id)
  }

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

export function closeRightWorkspaceTabForTerminal(terminalId: string): void {
  closeRightWorkspaceTab(terminalTabId(terminalId))
}

export function closeAllRightWorkspaceTerminalTabs(): void {
  const current = $rightWorkspaceTabs.get()
  const next = current.filter(tab => tab.kind !== 'terminal')

  $rightWorkspaceTabs.set(next)

  if ($activeRightWorkspaceTabId.get() && !next.some(tab => tab.id === $activeRightWorkspaceTabId.get())) {
    $activeRightWorkspaceTabId.set(next.at(-1)?.id ?? null)
  }
}

export function closeOtherRightWorkspaceTerminalTabs(terminalId: string): void {
  const keepId = terminalTabId(terminalId)
  const current = $rightWorkspaceTabs.get()
  const next = current.filter(tab => tab.kind !== 'terminal' || tab.id === keepId)

  $rightWorkspaceTabs.set(next)

  if ($activeRightWorkspaceTabId.get() && !next.some(tab => tab.id === $activeRightWorkspaceTabId.get())) {
    $activeRightWorkspaceTabId.set(keepId)
  }
}

export function selectRightWorkspaceTabForTerminal(terminalId: string): void {
  selectRightWorkspaceTab(terminalTabId(terminalId))
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

export function openFilesWorkspaceTargetFromTab(sourceTabId: string, target: PreviewTarget): RightWorkspaceTab {
  const id = filesTabId(target)
  const timestamp = now()
  const current = $rightWorkspaceTabs.get()
  const existing = current.find(tab => tab.id === id)

  if (existing) {
    const nextTab = buildRightWorkspaceTab({ kind: 'files', target }, id, timestamp, existing)
    $rightWorkspaceTabs.set(current.map(tab => (tab.id === id ? { ...tab, ...nextTab } : tab)))
    $activeRightWorkspaceTabId.set(id)
    setRightWorkspaceOpen(true)

    return nextTab
  }

  const source = current.find(tab => tab.id === sourceTabId)
  const shouldReplaceSource = Boolean(source && source.kind === 'files' && !source.target)
  const nextTab = buildRightWorkspaceTab({ kind: 'files', target }, id, timestamp, source)

  $rightWorkspaceTabs.set(shouldReplaceSource ? current.map(tab => (tab.id === sourceTabId ? nextTab : tab)) : [...current, nextTab])
  $activeRightWorkspaceTabId.set(id)
  setRightWorkspaceOpen(true)

  return nextTab
}

export function openEmptyFilesWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'files', target: null, title: 'Open file' })
}

export function openReviewWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'review' })
}

export function openTerminalWorkspace(): RightWorkspaceTab {
  return openRightWorkspaceTab({ kind: 'terminal' })
}

export function openTerminalWorkspaceForTerminal(terminalId: string, title = 'Terminal', activate = true): RightWorkspaceTab {
  return openRightWorkspaceTab({ activate, kind: 'terminal', terminalId, title })
}

export function openBrowserWorkspace(url = 'https://example.com', activate = true): RightWorkspaceTab {
  return openRightWorkspaceTab({ activate, kind: 'browser', title: 'Browser', url })
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

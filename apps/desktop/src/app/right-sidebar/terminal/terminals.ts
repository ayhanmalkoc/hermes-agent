import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'
import {
  closeAllRightWorkspaceTerminalTabs,
  closeOtherRightWorkspaceTerminalTabs,
  closeRightWorkspaceTabForTerminal,
  openTerminalWorkspaceForTerminal,
  selectRightWorkspaceTabForTerminal
} from '@/store/right-workspace'
import { $connection, $currentCwd } from '@/store/session'

import { setTerminalTakeover } from '../store'

import { seedAgentTerminalCommand } from './agent-terminal-stream'

/** One in-app terminal tab. `id` is the renderer-side handle (distinct from the
 *  PTY session id the main process mints); each instance owns its own shell. */
export interface TerminalEntry {
  id: string
  /** Display label. `auto` adopts the resolved shell name until the user renames. */
  title: string
  auto: boolean
  /** Working directory, snapshotted once at creation. Terminals live outside
   *  session/project state — the only thing they inherit is this initial cwd
   *  (the project root if opened in one, else the backend's default). */
  cwd: string
  /** Conversation/right-workspace owner. Hidden sessions stay mounted so their
   *  PTYs survive session switches; this key gates visibility and persistence. */
  scopeKey: string
  /** Serialized xterm scrollback from the last session, replayed on relaunch so
   *  the tab reopens with its recent history (VS Code parity). Processes are NOT
   *  revived — a fresh shell starts beneath the restored buffer. Captured live
   *  for user tabs only; agent mirrors stay runtime-only. */
  reviveBuffer?: string
  /** `user` = interactive PTY shell. `agent` = read-only mirror of an agent
   *  background process (`terminal(background=true)`), keyed by `procId`. */
  kind: 'user' | 'agent'
  procId?: string
}

interface PersistedTerminalEntry {
  auto: boolean
  cwd: string
  id: string
  reviveBuffer?: string
  title: string
}

interface PersistedTerminalState {
  activeTerminalId: null | string
  terminals: PersistedTerminalEntry[]
}

const TERMINALS_STORAGE_KEY = 'hermes.desktop.terminals.v1'
const DEFAULT_SCOPE_KEY = 'global'

let activeScopeKey = DEFAULT_SCOPE_KEY

function terminalsStorageKey(scopeKey = activeScopeKey): string {
  const connection = $connection.get()
  const scope = encodeURIComponent(scopeKey || DEFAULT_SCOPE_KEY)

  if (connection?.mode !== 'remote') {
    return scopeKey === DEFAULT_SCOPE_KEY ? TERMINALS_STORAGE_KEY : `${TERMINALS_STORAGE_KEY}.scope.${scope}`
  }

  const base = encodeURIComponent(connection.baseUrl || 'remote')
  const profile = encodeURIComponent(connection.profile || 'default')

  return `${TERMINALS_STORAGE_KEY}.remote.${base}.${profile}.scope.${scope}`
}

// Cap a single tab's replayed history so the persisted layout can't blow the
// localStorage quota. Roughly mirrors VS Code's persistentSessionScrollback
// default (100 lines) once the serialized escape codes are counted in.
const MAX_REVIVE_BUFFER_CHARS = 48_000

function sanitizePersistedTerminal(value: unknown): PersistedTerminalEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const cwd = typeof record.cwd === 'string' ? record.cwd : ''
  const reviveBuffer = typeof record.reviveBuffer === 'string' ? record.reviveBuffer : undefined

  if (!id) {
    return null
  }

  return {
    auto: typeof record.auto === 'boolean' ? record.auto : true,
    cwd,
    id,
    ...(reviveBuffer ? { reviveBuffer } : {}),
    title: title || 'Terminal'
  }
}

function loadPersistedTerminals(): PersistedTerminalState {
  const fallback: PersistedTerminalState = { activeTerminalId: null, terminals: [] }
  const raw = readKey(terminalsStorageKey())

  if (!raw) {
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback
    }

    const record = parsed as Record<string, unknown>

    const terminals = Array.isArray(record.terminals)
      ? record.terminals.map(sanitizePersistedTerminal).filter((term): term is PersistedTerminalEntry => Boolean(term))
      : []

    const active =
      typeof record.activeTerminalId === 'string' && terminals.some(term => term.id === record.activeTerminalId)
        ? record.activeTerminalId
        : (terminals[0]?.id ?? null)

    return { activeTerminalId: active, terminals }
  } catch {
    return fallback
  }
}

// Persist synchronously on every change (the app-wide convention — see panes.ts
// / layout.ts). Capturing history this way means a snapshot is already on disk
// well before the renderer tears down, so app quit needs no unload hook.
function persistTerminals(list: readonly TerminalEntry[], activeTerminalId: null | string, scopeKey = activeScopeKey) {
  const terminals = list
    .filter(term => term.kind === 'user' && term.scopeKey === scopeKey)
    .map(term => ({
      auto: term.auto,
      cwd: term.cwd,
      id: term.id,
      ...(term.reviveBuffer ? { reviveBuffer: term.reviveBuffer } : {}),
      title: term.title
    }))

  if (!terminals.length) {
    writeKey(terminalsStorageKey(scopeKey), null)

    return
  }

  const active = terminals.some(term => term.id === activeTerminalId) ? activeTerminalId : (terminals[0]?.id ?? null)
  writeKey(terminalsStorageKey(scopeKey), JSON.stringify({ activeTerminalId: active, terminals }))
}

const restored = loadPersistedTerminals()

export const $terminals = atom<readonly TerminalEntry[]>(
  restored.terminals.map(term => ({ ...term, kind: 'user' as const, scopeKey: activeScopeKey }))
)
export const $activeTerminalId = atom<string | null>(restored.activeTerminalId)

$terminals.subscribe(list => persistTerminals(list, $activeTerminalId.get()))
$activeTerminalId.subscribe(active => persistTerminals($terminals.get(), active))

function scopeTerminals(scopeKey = activeScopeKey): readonly TerminalEntry[] {
  return $terminals.get().filter(term => term.scopeKey === scopeKey || term.kind === 'agent')
}

function scopeActiveTerminal(scopeKey = activeScopeKey): string | null {
  const scoped = scopeTerminals(scopeKey).filter(term => term.kind === 'user')
  const active = $activeTerminalId.get()

  return active && scoped.some(term => term.id === active) ? active : (scoped[0]?.id ?? null)
}

export function setTerminalScope(scopeKey: string, options: { migrateFromScope?: string | null } = {}): void {
  const nextScopeKey = scopeKey || DEFAULT_SCOPE_KEY

  if (nextScopeKey === activeScopeKey) {
    return
  }

  const previousScopeKey = activeScopeKey
  persistTerminals($terminals.get(), $activeTerminalId.get(), previousScopeKey)
  activeScopeKey = nextScopeKey

  const restoredForScope = loadPersistedTerminals()
  const shouldMigratePrevious =
    !restoredForScope.terminals.length &&
    !nextScopeKey.startsWith('draft:') &&
    (previousScopeKey.startsWith('draft:') || previousScopeKey === options.migrateFromScope)

  if (shouldMigratePrevious) {
    let migratedActive = $activeTerminalId.get()
    $terminals.set(
      $terminals.get().map(term => (term.scopeKey === previousScopeKey ? { ...term, scopeKey: nextScopeKey } : term))
    )
    if (!migratedActive || !$terminals.get().some(term => term.id === migratedActive && term.scopeKey === nextScopeKey)) {
      migratedActive = scopeActiveTerminal(nextScopeKey)
    }
    $activeTerminalId.set(migratedActive)
    persistTerminals($terminals.get(), migratedActive, nextScopeKey)
    writeKey(terminalsStorageKey(previousScopeKey), null)
    return
  }

  const existingIds = new Set($terminals.get().map(term => term.id))
  const restoredEntries = restoredForScope.terminals
    .filter(term => !existingIds.has(term.id))
    .map(term => ({ ...term, kind: 'user' as const, scopeKey: nextScopeKey }))

  if (restoredEntries.length) {
    $terminals.set([...$terminals.get(), ...restoredEntries])
  }

  $activeTerminalId.set(restoredForScope.activeTerminalId ?? scopeActiveTerminal(nextScopeKey))
}

export const $activeTerminal = computed(
  [$terminals, $activeTerminalId],
  (list, id) => list.find(term => term.id === id) ?? null
)

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `term-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Append a fresh terminal and focus it. Captures the current cwd once (its only
 *  tie to session/project state); pass an explicit cwd to override. Returns the id. */
export function createTerminal(cwd: string = $currentCwd.get()): string {
  const id = newId()
  $terminals.set([...$terminals.get(), { id, title: 'Terminal', auto: true, cwd, kind: 'user', scopeKey: activeScopeKey }])
  $activeTerminalId.set(id)

  return id
}

export function createAndOpenTerminal(cwd?: string): string {
  const id = createTerminal(cwd)

  openTerminalWorkspaceForTerminal(id)
  setTerminalTakeover(true)

  return id
}

export function showTerminalWorkspace(): string {
  const list = scopeTerminals().filter(term => term.kind === 'user')
  const id = scopeActiveTerminal() ?? list[0]?.id ?? createTerminal()
  const title = $terminals.get().find(term => term.id === id)?.title

  openTerminalWorkspaceForTerminal(id, title)
  $activeTerminalId.set(id)
  setTerminalTakeover(true)

  return id
}

// Procs we've already surfaced a tab for — so closing an agent tab doesn't
// resurrect it on the next poll while the process is still running.
const surfacedProcs = new Set<string>()

const findByProc = (procId: string) => $terminals.get().find(term => term.procId === procId)

/** Auto-surface an agent background process as a read-only tab — once. Returns
 *  the tab id, or null if it was already surfaced and the user has since closed it. */
export function ensureAgentTerminal(procId: string, title: string): string | null {
  const existing = findByProc(procId)

  if (existing) {
    openTerminalWorkspaceForTerminal(existing.id, title || existing.title || 'agent', false)
    return existing.id
  }

  if (surfacedProcs.has(procId)) {
    return null
  }

  surfacedProcs.add(procId)
  const id = newId()
  $terminals.set([...$terminals.get(), { id, title: title || 'agent', auto: false, cwd: '', kind: 'agent', procId, scopeKey: activeScopeKey }])
  openTerminalWorkspaceForTerminal(id, title || 'agent')

  return id
}

/** Open + focus an agent process's tab (the status-stack link), recreating it if
 *  the user had closed it. Opens the pane. */
export function openAgentTerminal(procId: string, title: string): void {
  surfacedProcs.add(procId)
  seedAgentTerminalCommand(procId, title)
  let id = findByProc(procId)?.id

  if (!id) {
    id = newId()
    $terminals.set([...$terminals.get(), { id, title: title || 'agent', auto: false, cwd: '', kind: 'agent', procId, scopeKey: activeScopeKey }])
  }

  $activeTerminalId.set(id)
  openTerminalWorkspaceForTerminal(id, title || 'agent')
  setTerminalTakeover(true)
}

/** Guarantee at least one tab exists when the pane opens.
 *  If a status-stack click already opened an agent tab, don't create a
 *  second, unrelated user shell just because the pane became visible. */
export function ensureTerminal(): void {
  if (scopeTerminals().filter(term => term.kind === 'user').length === 0) {
    const id = createTerminal()
    openTerminalWorkspaceForTerminal(id)
  }
}

export function selectTerminal(id: string): void {
  if (scopeTerminals().some(term => term.id === id)) {
    $activeTerminalId.set(id)
    selectRightWorkspaceTabForTerminal(id)
  }
}

/** Move the active tab by `direction` (+1 next / -1 prev), wrapping around. */
export function cycleTerminal(direction: 1 | -1): void {
  const list = scopeTerminals().filter(term => term.kind === 'user')

  if (list.length < 2) {
    return
  }

  const current = Math.max(
    0,
    list.findIndex(term => term.id === $activeTerminalId.get())
  )

  selectTerminal(list[(current + direction + list.length) % list.length].id)
}

/** Drop a terminal. Focus slides to the neighbor that fills its slot; closing
 *  the last one closes the whole pane. */
export function closeTerminal(id: string): void {
  const list = $terminals.get()
  const index = list.findIndex(term => term.id === id)

  if (index < 0) {
    return
  }

  const next = list.filter(term => term.id !== id)
  $terminals.set(next)

  if ($activeTerminalId.get() === id) {
    const nextActive = (next[index] ?? next[index - 1])?.id ?? null
    $activeTerminalId.set(nextActive)

    if (nextActive) {
      selectRightWorkspaceTabForTerminal(nextActive)
    }
  }

  closeRightWorkspaceTabForTerminal(id)

  if (!next.length) {
    setTerminalTakeover(false)
  }
}

/** Close the read-only agent tab mirroring a background process. The agent
 *  drives this via the desktop-gated `close_terminal` tool → `terminal.close`.
 *  The process is NOT killed — only the view is dropped; `surfacedProcs` keeps
 *  it from auto-resurfacing, and the status-stack row can reopen it on demand.
 *  No-op when no such tab exists. */
export function closeAgentTerminalByProc(procId: string): boolean {
  const id = procId.trim()
  const term = $terminals.get().find(t => t.kind === 'agent' && (t.procId === id || t.id === id))

  if (!term) {
    return false
  }

  closeTerminal(term.id)

  return true
}

export function closeActiveTerminal(): void {
  const id = $activeTerminalId.get()

  if (id) {
    closeTerminal(id)
  }
}

export function closeAllTerminals(): void {
  const scoped = scopeTerminals().filter(term => term.kind === 'user')

  if (scoped.length === 0) {
    return
  }

  const scopedIds = new Set(scoped.map(term => term.id))
  $terminals.set($terminals.get().filter(term => !scopedIds.has(term.id)))
  $activeTerminalId.set(null)
  closeAllRightWorkspaceTerminalTabs()
  setTerminalTakeover(false)
}

export function closeOtherTerminals(id: string): void {
  const keep = scopeTerminals().find(term => term.id === id)

  if (keep) {
    $terminals.set($terminals.get().filter(term => term.scopeKey !== activeScopeKey || term.id === keep.id))
    $activeTerminalId.set(keep.id)
    closeOtherRightWorkspaceTerminalTabs(keep.id)
    selectRightWorkspaceTabForTerminal(keep.id)
  }
}

/** Record the latest serialized scrollback for a tab so it can be replayed on
 *  the next launch. Oversized buffers are tail-trimmed to stay under the storage
 *  budget; only user tabs ever carry one. */
export function updateTerminalReviveBuffer(id: string, reviveBuffer: string): void {
  const capped =
    reviveBuffer.length > MAX_REVIVE_BUFFER_CHARS ? reviveBuffer.slice(-MAX_REVIVE_BUFFER_CHARS) : reviveBuffer

  $terminals.set(
    $terminals.get().map(term => (term.id === id && term.kind === 'user' ? { ...term, reviveBuffer: capped } : term))
  )
}

export function renameTerminal(id: string, title: string): void {
  const trimmed = title.trim()

  $terminals.set(
    $terminals.get().map(term => (term.id === id ? { ...term, title: trimmed || term.title, auto: false } : term))
  )
}

/** A live terminal reports its resolved shell; adopt it as the label only while
 *  the user hasn't named the tab themselves. */
export function reportTerminalShell(id: string, shell: string): void {
  const name = shell.trim()

  if (!name) {
    return
  }

  $terminals.set($terminals.get().map(term => (term.id === id && term.auto ? { ...term, title: name } : term)))
}

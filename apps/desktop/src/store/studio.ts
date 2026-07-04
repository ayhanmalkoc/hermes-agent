import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

const STORAGE_KEY = 'hermes.desktop.studio.state'

export interface StudioRunContext {
  goalEnabled: boolean
}

interface StudioState {
  modeEnabled: boolean
  runContext: StudioRunContext
}

const defaultState: StudioState = {
  modeEnabled: false,
  runContext: { goalEnabled: false }
}

function normalizeState(value: unknown): StudioState {
  const parsed = value && typeof value === 'object' ? (value as Partial<StudioState>) : {}
  const parsedContext = parsed.runContext && typeof parsed.runContext === 'object' ? parsed.runContext : {}

  return {
    modeEnabled: Boolean(parsed.modeEnabled),
    runContext: { goalEnabled: Boolean((parsedContext as Partial<StudioRunContext>).goalEnabled) }
  }
}

function loadState(): StudioState {
  const raw = readKey(STORAGE_KEY)

  if (!raw) {
    return defaultState
  }

  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    return defaultState
  }
}

function saveState(state: StudioState): void {
  writeKey(STORAGE_KEY, JSON.stringify(state))
}

export const $studioState = atom<StudioState>(loadState())

export const $studioModeEnabled = computed($studioState, state => state.modeEnabled)
export const $studioRunContext = computed($studioState, state => state.runContext)

function updateStudioState(updater: (state: StudioState) => StudioState): void {
  const next = updater($studioState.get())
  $studioState.set(next)
  saveState(next)
}

export function setStudioModeEnabled(enabled: boolean): void {
  updateStudioState(state => ({ ...state, modeEnabled: enabled }))
}

export function updateStudioRunContext(patch: Partial<StudioRunContext>): void {
  updateStudioState(state => ({ ...state, runContext: { ...state.runContext, ...patch } }))
}

export function toggleStudioGoal(): void {
  updateStudioRunContext({ goalEnabled: !$studioState.get().runContext.goalEnabled })
}

export function studioPromptText(text: string): string {
  return text
}

export function studioGoalCommand(text: string): string | null {
  if (!$studioState.get().runContext.goalEnabled) {
    return null
  }

  return `/goal ${text}`
}

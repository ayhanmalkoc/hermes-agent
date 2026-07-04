import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

const STORAGE_KEY = 'hermes.desktop.studio.state'

export type StudioTeamPolicy = 'lead_routes' | 'parallel' | 'sequential'
export type StudioActiveView = 'cockpit' | 'sessions' | 'agents' | 'teams' | 'outputs' | 'automations'
export type StudioLiveOpsTab = 'live' | 'approvals' | 'subagents' | 'terminal' | 'goal'

export interface StudioAgent {
  id: string
  name: string
  role: string
  model?: string
  toolset?: string
  skills?: string[]
  prompt?: string
  teamIds: string[]
  enabled: boolean
}

export interface StudioTeam {
  id: string
  name: string
  leadAgentId?: string
  memberAgentIds: string[]
  policy: StudioTeamPolicy
  defaultModel?: string
  defaultToolset?: string
}

export interface StudioRunContext {
  goalEnabled: boolean
  teamIds: string[]
  agentIds: string[]
  activeAgentId?: string
  modelOverride?: string
  toolset?: string
}

interface StudioState {
  modeEnabled: boolean
  activeView: StudioActiveView
  liveOpsTab: StudioLiveOpsTab
  agents: StudioAgent[]
  teams: StudioTeam[]
  runContext: StudioRunContext
}

const defaultAgents: StudioAgent[] = [
  {
    id: 'planner',
    name: 'Planner',
    role: 'Breaks the work into safe steps and keeps scope clear.',
    teamIds: ['desktop-team'],
    enabled: true
  },
  {
    id: 'builder',
    name: 'Builder',
    role: 'Implements focused Desktop changes using existing Hermes patterns.',
    teamIds: ['desktop-team'],
    enabled: true
  },
  {
    id: 'qa',
    name: 'QA',
    role: 'Checks regressions, approvals, and acceptance criteria.',
    teamIds: ['desktop-team'],
    enabled: true
  }
]

const defaultTeams: StudioTeam[] = [
  {
    id: 'desktop-team',
    name: 'Desktop Team',
    leadAgentId: 'planner',
    memberAgentIds: ['planner', 'builder', 'qa'],
    policy: 'lead_routes'
  }
]

const defaultState: StudioState = {
  modeEnabled: false,
  activeView: 'cockpit',
  liveOpsTab: 'live',
  agents: defaultAgents,
  teams: defaultTeams,
  runContext: { goalEnabled: false, teamIds: [], agentIds: [] }
}

function normalizeActiveView(value: unknown): StudioActiveView {
  return value === 'sessions' || value === 'agents' || value === 'teams' || value === 'outputs' || value === 'automations'
    ? value
    : 'cockpit'
}

function normalizeLiveOpsTab(value: unknown): StudioLiveOpsTab {
  return value === 'approvals' || value === 'subagents' || value === 'terminal' || value === 'goal' ? value : 'live'
}

function normalizeRunContext(value: unknown): StudioRunContext {
  const parsed = value && typeof value === 'object' ? (value as Partial<StudioRunContext>) : {}

  return {
    goalEnabled: Boolean(parsed.goalEnabled),
    teamIds: Array.isArray(parsed.teamIds) ? parsed.teamIds.filter(item => typeof item === 'string') : [],
    agentIds: Array.isArray(parsed.agentIds) ? parsed.agentIds.filter(item => typeof item === 'string') : [],
    activeAgentId: typeof parsed.activeAgentId === 'string' ? parsed.activeAgentId : undefined,
    modelOverride: typeof parsed.modelOverride === 'string' ? parsed.modelOverride : undefined,
    toolset: typeof parsed.toolset === 'string' ? parsed.toolset : undefined
  }
}

function normalizeState(value: unknown): StudioState {
  const parsed = value && typeof value === 'object' ? (value as Partial<StudioState>) : {}

  return {
    modeEnabled: Boolean(parsed.modeEnabled),
    activeView: normalizeActiveView(parsed.activeView),
    liveOpsTab: normalizeLiveOpsTab(parsed.liveOpsTab),
    agents: Array.isArray(parsed.agents) && parsed.agents.length ? parsed.agents : defaultAgents,
    teams: Array.isArray(parsed.teams) && parsed.teams.length ? parsed.teams : defaultTeams,
    runContext: normalizeRunContext(parsed.runContext)
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
export const $studioActiveView = computed($studioState, state => state.activeView)
export const $studioLiveOpsTab = computed($studioState, state => state.liveOpsTab)
export const $studioRunContext = computed($studioState, state => state.runContext)
export const $studioAgents = computed($studioState, state => state.agents)
export const $studioTeams = computed($studioState, state => state.teams)

function updateStudioState(updater: (state: StudioState) => StudioState): void {
  const next = updater($studioState.get())
  $studioState.set(next)
  saveState(next)
}

export function setStudioModeEnabled(enabled: boolean): void {
  updateStudioState(state => ({ ...state, modeEnabled: enabled }))
}

export function toggleStudioMode(): void {
  setStudioModeEnabled(!$studioModeEnabled.get())
}

export function exitStudioMode(): void {
  setStudioModeEnabled(false)
}

export function setStudioActiveView(activeView: StudioActiveView): void {
  updateStudioState(state => ({ ...state, activeView }))
}

export function setStudioLiveOpsTab(liveOpsTab: StudioLiveOpsTab): void {
  updateStudioState(state => ({ ...state, liveOpsTab }))
}

export function updateStudioRunContext(patch: Partial<StudioRunContext>): void {
  updateStudioState(state => ({ ...state, runContext: { ...state.runContext, ...patch } }))
}

export function toggleStudioGoal(): void {
  updateStudioRunContext({ goalEnabled: !$studioState.get().runContext.goalEnabled })
}

export function selectStudioTeam(teamId: string | undefined): void {
  const state = $studioState.get()
  const team = state.teams.find(item => item.id === teamId)

  updateStudioRunContext({
    teamIds: team ? [team.id] : [],
    agentIds: team?.memberAgentIds ?? [],
    activeAgentId: team?.leadAgentId,
    modelOverride: team?.defaultModel,
    toolset: team?.defaultToolset
  })
}

export function selectStudioAgent(agentId: string | undefined): void {
  const state = $studioState.get()
  const agent = state.agents.find(item => item.id === agentId)

  updateStudioRunContext({
    agentIds: agent ? Array.from(new Set([...state.runContext.agentIds, agent.id])) : [],
    activeAgentId: agent?.id,
    modelOverride: agent?.model ?? state.runContext.modelOverride,
    toolset: agent?.toolset ?? state.runContext.toolset
  })
}

export function setStudioModelOverride(modelOverride: string | undefined): void {
  updateStudioRunContext({ modelOverride: modelOverride?.trim() || undefined })
}

export function setStudioToolset(toolset: string | undefined): void {
  updateStudioRunContext({ toolset: toolset?.trim() || undefined })
}

export function studioPromptText(input: string): string {
  const message = input.trim()
  if (!message) {
    return message
  }

  const state = $studioState.get()
  if (!state.modeEnabled) {
    return message
  }

  const context = state.runContext
  const parts: string[] = []
  const selectedTeams = state.teams.filter(item => context.teamIds.includes(item.id))
  const selectedAgents = state.agents.filter(item => context.agentIds.includes(item.id))
  const activeAgent = state.agents.find(item => item.id === context.activeAgentId)

  if (selectedTeams.length) {
    parts.push(`Team: ${selectedTeams.map(item => item.name).join(', ')}`)
  }
  if (selectedAgents.length) {
    parts.push(`Agents: ${selectedAgents.map(item => item.name).join(', ')}`)
  }
  if (activeAgent) {
    parts.push(`Active agent: ${activeAgent.name}`)
  }
  if (context.modelOverride) {
    parts.push(`Model: ${context.modelOverride}`)
  }
  if (context.toolset) {
    parts.push(`Toolset: ${context.toolset}`)
  }

  if (!parts.length) {
    return message
  }

  return `[Studio Context]\n${parts.join('\n')}\n\n${message}`
}

export function studioGoalCommand(input: string): string {
  const message = studioPromptText(input).trim()
  return message.startsWith('/goal') ? message : `/goal ${message}`
}

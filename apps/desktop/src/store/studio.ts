import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

const STORAGE_KEY = 'hermes.desktop.studio.state'

export type StudioTeamPolicy = 'lead_routes' | 'parallel' | 'sequential'

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
  agents: defaultAgents,
  teams: defaultTeams,
  runContext: { goalEnabled: false, teamIds: [], agentIds: [] }
}

function normalizeState(value: unknown): StudioState {
  const parsed = value && typeof value === 'object' ? (value as Partial<StudioState>) : {}

  return {
    ...defaultState,
    ...parsed,
    agents: Array.isArray(parsed.agents) && parsed.agents.length ? parsed.agents : defaultAgents,
    teams: Array.isArray(parsed.teams) && parsed.teams.length ? parsed.teams : defaultTeams,
    runContext: { ...defaultState.runContext, ...(parsed.runContext ?? {}) }
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

function selectedLabels() {
  const state = $studioState.get()
  const context = state.runContext
  const teams = context.teamIds.map(id => state.teams.find(item => item.id === id)?.name).filter(Boolean)
  const agents = context.agentIds.map(id => state.agents.find(item => item.id === id)?.name).filter(Boolean)
  const activeAgent = state.agents.find(item => item.id === context.activeAgentId)

  return { activeAgent, agents, context, teams }
}

export function studioContextBlock(): string {
  const { activeAgent, agents, context, teams } = selectedLabels()
  const lines = ['Studio context:']

  if (context.goalEnabled) lines.push('- Goal mode: enabled')
  if (teams.length) lines.push(`- Team: ${teams.join(', ')}`)
  if (agents.length) lines.push(`- Agents: ${agents.join(', ')}`)
  if (activeAgent) lines.push(`- Active agent focus: ${activeAgent.name} — ${activeAgent.role}`)
  if (context.modelOverride) lines.push(`- Model override: ${context.modelOverride}`)
  if (context.toolset) lines.push(`- Toolset: ${context.toolset}`)

  return lines.length > 1 ? lines.join('\n') : ''
}

export function studioPromptText(text: string): string {
  const block = studioContextBlock()

  return block ? `${block}\n\nUser request:\n${text}` : text
}

export function studioGoalCommand(text: string): string | null {
  if (!$studioState.get().runContext.goalEnabled) {
    return null
  }

  return `/goal ${studioPromptText(text)}`
}

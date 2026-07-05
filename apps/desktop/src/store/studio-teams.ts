import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

const TEAMS_STORAGE_KEY = 'hermes.desktop.studio.teams'
const ASSIGNMENTS_STORAGE_KEY = 'hermes.desktop.studio.teamAssignments'
const DRAFT_SESSION_KEY = 'draft'

export interface StudioTeam {
  description: string
  id: string
  instructions: string
  name: string
  profileIds: string[]
}

function parseJson<T>(raw: null | string, fallback: T): T {
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function normalizeTeam(value: unknown): StudioTeam | null {
  const row = value && typeof value === 'object' ? (value as Partial<StudioTeam>) : null

  if (!row?.id || !row.name) return null

  return {
    description: String(row.description ?? ''),
    id: String(row.id),
    instructions: String(row.instructions ?? ''),
    name: String(row.name),
    profileIds: Array.isArray(row.profileIds) ? [...new Set(row.profileIds.map(String).filter(Boolean))] : []
  }
}

function normalizeTeams(value: unknown): StudioTeam[] {
  return Array.isArray(value) ? value.map(normalizeTeam).filter((team): team is StudioTeam => Boolean(team)) : []
}

function normalizeAssignments(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([sessionKey, teamId]) => [sessionKey, typeof teamId === 'string' ? teamId : ''])
      .filter(([, teamId]) => teamId)
  )
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sessionKey(value: null | string | undefined): string {
  return value?.trim() || DRAFT_SESSION_KEY
}

export const $studioTeams = atom<StudioTeam[]>(normalizeTeams(parseJson(readKey(TEAMS_STORAGE_KEY), [])))
export const $studioTeamAssignments = atom<Record<string, string>>(
  normalizeAssignments(parseJson(readKey(ASSIGNMENTS_STORAGE_KEY), {}))
)

export const $studioTeamsById = computed($studioTeams, teams => new Map(teams.map(team => [team.id, team])))

function saveTeams(teams: StudioTeam[]): void {
  $studioTeams.set(teams)
  writeKey(TEAMS_STORAGE_KEY, JSON.stringify(teams))
}

function saveAssignments(assignments: Record<string, string>): void {
  $studioTeamAssignments.set(assignments)
  writeKey(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments))
}

export function createStudioTeam(input: Omit<StudioTeam, 'id'>): StudioTeam {
  const team = normalizeTeam({ ...input, id: newId() })!
  saveTeams([...$studioTeams.get(), team])

  return team
}

export function updateStudioTeam(id: string, patch: Partial<Omit<StudioTeam, 'id'>>): void {
  saveTeams($studioTeams.get().map(team => (team.id === id ? normalizeTeam({ ...team, ...patch, id }) ?? team : team)))
}

export function deleteStudioTeam(id: string): void {
  saveTeams($studioTeams.get().filter(team => team.id !== id))
  saveAssignments(Object.fromEntries(Object.entries($studioTeamAssignments.get()).filter(([, teamId]) => teamId !== id)))
}

export function setStudioTeamForSession(sessionId: null | string | undefined, teamId: null | string): void {
  const key = sessionKey(sessionId)
  const next = { ...$studioTeamAssignments.get() }

  if (teamId) next[key] = teamId
  else delete next[key]

  saveAssignments(next)
}

export function getStudioTeamForSession(sessionId: null | string | undefined): StudioTeam | null {
  const teamId = $studioTeamAssignments.get()[sessionKey(sessionId)]

  return teamId ? ($studioTeamsById.get().get(teamId) ?? null) : null
}

export function studioTeamPromptContext(sessionId: null | string | undefined): string {
  const team = getStudioTeamForSession(sessionId)

  if (!team) return ''

  const members = team.profileIds.length ? team.profileIds.join(', ') : 'No explicit members selected'
  const instructions = team.instructions.trim() || 'Use the team members when delegation would improve the result.'

  return [
    'Studio team context:',
    `Team: ${team.name}`,
    team.description ? `Description: ${team.description}` : '',
    `Members: ${members}`,
    `Instructions: ${instructions}`,
    'The active Hermes profile is the lead/manager. Use existing delegate_task/subagents when useful.'
  ]
    .filter(Boolean)
    .join('\n')
}

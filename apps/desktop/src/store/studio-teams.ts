import { atom, computed } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

const TEAMS_STORAGE_KEY = 'hermes.desktop.studio.teams'
export const DRAFT_STUDIO_SESSION_KEY = 'draft'

export interface StudioTeam {
  description: string
  id: string
  instructions: string
  name: string
  profileIds: string[]
}

export type StudioTeamGateway = <T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeoutMs?: number
) => Promise<T>

interface StudioTeamResponse {
  team?: null | StudioTeam
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

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const $studioTeams = atom<StudioTeam[]>(normalizeTeams(parseJson(readKey(TEAMS_STORAGE_KEY), [])))
export const $studioTeamAssignments = atom<Record<string, string>>({})

export const $studioTeamsById = computed($studioTeams, teams => new Map(teams.map(team => [team.id, team])))

function saveTeams(teams: StudioTeam[]): void {
  $studioTeams.set(teams)
  writeKey(TEAMS_STORAGE_KEY, JSON.stringify(teams))
}

function updateCachedAssignment(sessionId: null | string | undefined, teamId: null | string): void {
  const key = sessionId?.trim() || DRAFT_STUDIO_SESSION_KEY
  const next = { ...$studioTeamAssignments.get() }

  if (teamId) next[key] = teamId
  else delete next[key]

  $studioTeamAssignments.set(next)
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
  const next = Object.fromEntries(Object.entries($studioTeamAssignments.get()).filter(([, teamId]) => teamId !== id))
  $studioTeamAssignments.set(next)
}

export async function setStudioTeamForSession(
  sessionId: null | string | undefined,
  teamId: null | string,
  requestGateway?: StudioTeamGateway
): Promise<void> {
  const sid = sessionId?.trim() || ''
  const team = teamId ? ($studioTeamsById.get().get(teamId) ?? null) : null

  updateCachedAssignment(sid || null, team?.id ?? null)

  if (!sid || !requestGateway) return

  await requestGateway('studio.team.set', { session_id: sid, team })
}

export async function setStudioTeamForSessions(
  sessionIds: Array<null | string | undefined>,
  teamId: null | string,
  requestGateway?: StudioTeamGateway
): Promise<void> {
  const ids = [...new Set(sessionIds.map(sessionId => sessionId?.trim()).filter((id): id is string => Boolean(id)))]

  if (!ids.length) {
    await setStudioTeamForSession(null, teamId, requestGateway)
    return
  }

  await Promise.all(ids.map(sessionId => setStudioTeamForSession(sessionId, teamId, requestGateway)))
}

export function getStudioTeamForSession(sessionId: null | string | undefined): StudioTeam | null {
  const teamId = $studioTeamAssignments.get()[sessionId?.trim() || DRAFT_STUDIO_SESSION_KEY]

  return teamId ? ($studioTeamsById.get().get(teamId) ?? null) : null
}

export async function getStudioTeamForSessionRuntime(
  sessionId: null | string | undefined,
  requestGateway?: StudioTeamGateway
): Promise<StudioTeam | null> {
  const sid = sessionId?.trim() || ''

  if (!sid || !requestGateway) return getStudioTeamForSession(sessionId)

  const cached = getStudioTeamForSession(sid)

  try {
    const result = await requestGateway<StudioTeamResponse>('studio.team.get', { session_id: sid })
    const team = normalizeTeam(result?.team)
    if (team) updateCachedAssignment(sid, team.id)
    return team ?? cached
  } catch {
    return cached
  }
}

export async function bindDraftStudioTeamToSession(
  sessionId: null | string | undefined,
  requestGateway?: StudioTeamGateway
): Promise<void> {
  const sid = sessionId?.trim() || ''

  if (!sid) return

  const draftTeamId = $studioTeamAssignments.get()[DRAFT_STUDIO_SESSION_KEY]
  const current = getStudioTeamForSession(sid)

  if (!draftTeamId || current) return
  if (!$studioTeamsById.get().has(draftTeamId)) {
    updateCachedAssignment(null, null)
    return
  }

  await setStudioTeamForSession(sid, draftTeamId, requestGateway)
  updateCachedAssignment(null, null)
}

export function studioTeamPromptContextFromTeam(team: null | StudioTeam): string {
  if (!team) return ''

  const members = team.profileIds.length ? team.profileIds.join(', ') : 'No explicit members selected'
  const instructions = team.instructions.trim() || 'Use the team members when delegation would improve the result.'

  return [
    'Studio team context:',
    `Team: ${team.name}`,
    team.description ? `Description: ${team.description}` : '',
    `Members: ${members}`,
    `Instructions: ${instructions}`,
    'The active Hermes profile is the lead/manager for this Studio team.',
    'The listed members are specialized Hermes profiles available for delegated work.',
    'Use the team deliberately:',
    '- For simple one-shot questions, short explanations, direct answers, or trivial confirmations, answer directly without delegation.',
    '- For multi-step, ambiguous, high-risk, coding, research, design, testing, review, deployment, or runtime-ops work, consider delegating useful sub-tasks with delegate_task.',
    '- Do not delegate just because a team exists; delegate when parallel expertise materially improves quality, speed, or confidence.',
    '- When delegating, use each member exact profile id with tasks[].profile_id, or profile_id for a single task.',
    '- Give each delegated member a focused goal, relevant context, and expected output.',
    '- After delegated work completes, synthesize the results yourself and present one coherent answer.',
    '- If no listed member fits a needed sub-task, handle it yourself or explain the gap briefly.'
  ]
    .filter(Boolean)
    .join('\n')
}

export function studioTeamPromptContext(sessionId: null | string | undefined): string {
  return studioTeamPromptContextFromTeam(getStudioTeamForSession(sessionId))
}

export async function studioTeamPromptContextForSession(
  sessionId: null | string | undefined,
  requestGateway?: StudioTeamGateway
): Promise<string> {
  return studioTeamPromptContextFromTeam(await getStudioTeamForSessionRuntime(sessionId, requestGateway))
}

export async function studioTeamPromptContextForSessions(
  sessionIds: Array<null | string | undefined>,
  requestGateway?: StudioTeamGateway
): Promise<string> {
  const ids = [...new Set(sessionIds.map(sessionId => sessionId?.trim()).filter((id): id is string => Boolean(id)))]

  for (const sessionId of ids) {
    const team = await getStudioTeamForSessionRuntime(sessionId, requestGateway)
    if (team) return studioTeamPromptContextFromTeam(team)
  }

  return studioTeamPromptContext(null)
}

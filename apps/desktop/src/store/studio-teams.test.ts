import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProfileInfo } from '@/types/hermes'

import {
  $studioTeamAssignments,
  $studioTeams,
  bindDraftStudioTeamToSession,
  createStudioTeam,
  deleteStudioTeam,
  getStudioTeamForSession,
  setStudioTeamForSessions,
  setStudioTeamForSession,
  studioTeamPromptContext,
  studioTeamPromptContextForSessions,
  updateStudioTeam
} from './studio-teams'
import {
  BUILTIN_STUDIO_AGENT_PRESETS,
  BUILTIN_STUDIO_TEAM_PRESETS,
  createStudioTeamFromPreset,
  ensureStudioAgentPresetProfile,
  getStudioTeamPresetAgents,
  getStudioTeamPresetForTeam,
  studioTeamFromPreset,
  uniquePresetTeamName,
  type StudioPresetProfileClient
} from './studio-team-presets'

const profile = (name: string): ProfileInfo => ({
  has_env: false,
  is_default: name === 'default',
  model: null,
  name,
  path: '',
  provider: null,
  skill_count: 0
})

const profileClient = () => ({
  createProfile: vi.fn(async () => ({ name: 'created', ok: true, path: '/tmp/profile' })),
  updateProfileSoul: vi.fn(async () => ({ ok: true }))
}) satisfies StudioPresetProfileClient

describe('studio teams store', () => {
  afterEach(() => {
    $studioTeams.set([])
    $studioTeamAssignments.set({})
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('creates, updates, assigns, and deletes persisted teams', () => {
    const team = createStudioTeam({
      description: 'Desktop feature work',
      instructions: 'Split research and implementation.',
      name: 'Desktop Team',
      profileIds: ['default', 'qa', 'qa']
    })

    expect(team.profileIds).toEqual(['default', 'qa'])
    updateStudioTeam(team.id, { name: 'Studio Team', profileIds: ['planner'] })
    setStudioTeamForSession('session-a', team.id)

    expect(getStudioTeamForSession('session-a')?.name).toBe('Studio Team')
    expect(studioTeamPromptContext('session-a')).toContain('Members: planner')

    deleteStudioTeam(team.id)

    expect($studioTeams.get()).toEqual([])
    expect($studioTeamAssignments.get()).toEqual({})
    expect(getStudioTeamForSession('session-a')).toBeNull()
  })

  it('adds team instructions without changing the active profile contract', () => {
    const team = createStudioTeam({
      description: '',
      instructions: '',
      name: 'QA Team',
      profileIds: []
    })

    setStudioTeamForSession(null, team.id)

    expect(studioTeamPromptContext(null)).toContain('No explicit members selected')
    expect(studioTeamPromptContext(null)).toContain('The active Hermes profile is the lead/manager')
    expect(studioTeamPromptContext(null)).toContain('delegate_task')
    expect(studioTeamPromptContext(null)).toContain('Do not delegate just because a team exists')
    expect(studioTeamPromptContext(null)).toContain('For simple one-shot questions')
    expect(studioTeamPromptContext(null)).toContain('tasks[].profile_id')
    expect(studioTeamPromptContext(null)).toContain('profile_id')
  })

  it('binds a draft team selection to the first real session', async () => {
    const team = createStudioTeam({
      description: 'Product delivery',
      instructions: 'Delegate by profile id.',
      name: 'Delivery Team',
      profileIds: ['planner', 'coder']
    })

    setStudioTeamForSession(null, team.id)
    await bindDraftStudioTeamToSession('session-new')

    expect(getStudioTeamForSession('session-new')?.id).toBe(team.id)
    expect(getStudioTeamForSession(null)).toBeNull()
    expect(studioTeamPromptContext('session-new')).toContain('Team: Delivery Team')
    expect(studioTeamPromptContext('session-new')).toContain('Members: planner, coder')
  })

  it('keeps draft team selection ephemeral instead of persisting it', () => {
    const team = createStudioTeam({
      description: 'Ephemeral draft',
      instructions: 'Use selected profiles.',
      name: 'Draft Team',
      profileIds: ['planner']
    })

    setStudioTeamForSession(null, team.id)

    expect(getStudioTeamForSession(null)?.id).toBe(team.id)
    expect(window.localStorage.getItem('hermes.desktop.studio.teamDraftAssignment')).toBeNull()
  })

  it('resolves team prompt context across runtime and stored session ids', async () => {
    const team = createStudioTeam({
      description: 'Feature delivery',
      instructions: 'Use selected profiles.',
      name: 'Feature Team',
      profileIds: ['coder', 'qa']
    })

    await setStudioTeamForSessions(['runtime-id', 'stored-id'], team.id)

    expect(await studioTeamPromptContextForSessions(['runtime-id', 'stored-id'])).toContain('Team: Feature Team')
    expect(await studioTeamPromptContextForSessions(['missing-id', 'stored-id'])).toContain('Members: coder, qa')
  })

  it('uses an existing profile for an agent preset without overwriting it', async () => {
    const client = profileClient()
    const result = await ensureStudioAgentPresetProfile('planner', [profile('planner')], client)

    expect(result).toMatchObject({ created: false, profileId: 'planner' })
    expect(client.createProfile).not.toHaveBeenCalled()
    expect(client.updateProfileSoul).not.toHaveBeenCalled()
  })

  it('creates an absent profile for an agent preset and writes SOUL once', async () => {
    const client = profileClient()
    const result = await ensureStudioAgentPresetProfile('planner', [profile('default')], client)

    expect(result).toMatchObject({ created: true, profileId: 'planner' })
    expect(client.createProfile).toHaveBeenCalledWith({ name: 'planner', clone_from: 'default' })
    expect(client.updateProfileSoul).toHaveBeenCalledWith('planner', expect.stringContaining('Planner'))
  })

  it('clones a built-in team preset into an editable studio team after ensuring agents', async () => {
    const preset = BUILTIN_STUDIO_TEAM_PRESETS.find(item => item.id === 'coding-team')!
    const client = profileClient()
    const result = await createStudioTeamFromPreset(preset.id, [profile('planner')], client)
    const team = result!.team

    expect(team.id).not.toBe(preset.id)
    expect(team.name).toBe('Coding Team')
    expect(team.description).toBe(preset.description)
    expect(team.instructions).toContain('Delegate')
    expect(team.profileIds).toEqual(['planner', 'coder', 'tester', 'reviewer'])
    expect(result!.agents.map(agent => [agent.profileId, agent.created])).toEqual([
      ['planner', false],
      ['coder', true],
      ['tester', true],
      ['reviewer', true]
    ])
    expect($studioTeams.get()).toEqual([team])
  })

  it('normalizes team presets through the existing team model', () => {
    const team = studioTeamFromPreset({
      agents: ['planner', 'planner', 'reviewer', 'missing-agent'],
      description: 'Duplicate agent ids are allowed in preset data but not saved teams.',
      id: 'duplicate-members',
      instructions: 'Delegate by profile_id.',
      name: 'Duplicate Members'
    })

    expect(team.profileIds).toEqual(['planner', 'reviewer'])
  })

  it('chooses a unique team name when importing the same preset repeatedly', async () => {
    const client = profileClient()
    await createStudioTeamFromPreset('coding-team', BUILTIN_STUDIO_AGENT_PRESETS.map(agent => profile(agent.profileId)), client)
    await createStudioTeamFromPreset('coding-team', BUILTIN_STUDIO_AGENT_PRESETS.map(agent => profile(agent.profileId)), client)

    expect($studioTeams.get().map(team => team.name)).toEqual(['Coding Team', 'Coding Team 2'])
    expect(uniquePresetTeamName('Coding Team')).toBe('Coding Team 3')
    expect(client.createProfile).not.toHaveBeenCalled()
  })

  it('keeps preset imports compatible with studio prompt context', async () => {
    const result = await createStudioTeamFromPreset('runtime-ops-team', [], profileClient())
    const team = result!.team

    setStudioTeamForSession(null, team.id)

    expect(studioTeamPromptContext(null)).toContain('Team: Runtime Ops Team')
    expect(studioTeamPromptContext(null)).toContain('Members: inspector, deployer, log-analyst')
    expect(studioTeamPromptContext(null)).toContain('profile_id')
  })

  it('resolves preset metadata for imported teams and duplicate-name copies', async () => {
    const profiles = BUILTIN_STUDIO_AGENT_PRESETS.map(agent => profile(agent.profileId))
    const first = (await createStudioTeamFromPreset('research-team', profiles, profileClient()))!.team
    const second = (await createStudioTeamFromPreset('research-team', profiles, profileClient()))!.team

    expect(first.name).toBe('Research Team')
    expect(second.name).toBe('Research Team 2')
    expect(getStudioTeamPresetForTeam(first)?.id).toBe('research-team')
    expect(getStudioTeamPresetAgents(getStudioTeamPresetForTeam(second)!).map(agent => agent.profileId)).toEqual([
      'researcher',
      'verifier',
      'synthesizer'
    ])
  })
})

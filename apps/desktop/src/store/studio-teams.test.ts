import { afterEach, describe, expect, it } from 'vitest'

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

describe('studio teams store', () => {
  afterEach(() => {
    $studioTeams.set([])
    $studioTeamAssignments.set({})
    window.localStorage.clear()
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
    expect(studioTeamPromptContext('session-new')).toContain('Team: Delivery Team')
    expect(studioTeamPromptContext('session-new')).toContain('Members: planner, coder')
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
})

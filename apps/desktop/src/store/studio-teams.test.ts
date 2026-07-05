import { afterEach, describe, expect, it } from 'vitest'

import {
  $studioTeamAssignments,
  $studioTeams,
  createStudioTeam,
  deleteStudioTeam,
  getStudioTeamForSession,
  setStudioTeamForSession,
  studioTeamPromptContext,
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
})

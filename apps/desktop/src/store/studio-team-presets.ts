import { createProfile, updateProfileSoul, type ProfileInfo } from '@/hermes'

import { $studioTeams, createStudioTeam, type StudioTeam } from './studio-teams'

export interface StudioAgentPreset {
  cloneFrom?: null | string
  description: string
  id: string
  name: string
  profileId: string
  soul: string
  tags?: string[]
}

export interface StudioTeamPreset {
  agents: string[]
  description: string
  id: string
  instructions: string
  name: string
  tags?: string[]
}

export interface StudioAgentPresetImportResult {
  created: boolean
  preset: StudioAgentPreset
  profileId: string
}

export interface StudioTeamPresetImportResult {
  agents: StudioAgentPresetImportResult[]
  team: StudioTeam
}

export interface StudioPresetProfileClient {
  createProfile: typeof createProfile
  updateProfileSoul: typeof updateProfileSoul
}

const DEFAULT_PROFILE_CLIENT: StudioPresetProfileClient = {
  createProfile,
  updateProfileSoul
}

const soul = (role: string, focus: string) => `You are the ${role} Studio agent.\n\nFocus: ${focus}\n\nWork as a Hermes profile member. When delegated work arrives, stay within your specialty, report assumptions, and return concise actionable results.`

export const BUILTIN_STUDIO_AGENT_PRESETS: StudioAgentPreset[] = [
  {
    description: 'Breaks ambiguous work into concrete implementation steps.',
    id: 'planner',
    name: 'Planner',
    profileId: 'planner',
    soul: soul('Planner', 'decompose goals, define order, identify dependencies and acceptance checks.'),
    tags: ['planning']
  },
  {
    description: 'Implements focused code changes.',
    id: 'coder',
    name: 'Coder',
    profileId: 'coder',
    soul: soul('Coder', 'make minimal, high-quality code changes that match the existing codebase.'),
    tags: ['code']
  },
  {
    description: 'Runs targeted checks and expands regression coverage.',
    id: 'tester',
    name: 'Tester',
    profileId: 'tester',
    soul: soul('Tester', 'verify behavior with targeted tests and call out untested risk.'),
    tags: ['tests']
  },
  {
    description: 'Reviews risks, edge cases, and maintainability.',
    id: 'reviewer',
    name: 'Reviewer',
    profileId: 'reviewer',
    soul: soul('Reviewer', 'inspect correctness, maintainability, regressions, and repo-rule fit.'),
    tags: ['review']
  },
  {
    description: 'Finds relevant facts and candidate sources.',
    id: 'researcher',
    name: 'Researcher',
    profileId: 'researcher',
    soul: soul('Researcher', 'gather relevant information and separate evidence from assumptions.'),
    tags: ['research']
  },
  {
    description: 'Checks source quality and conflicts.',
    id: 'verifier',
    name: 'Verifier',
    profileId: 'verifier',
    soul: soul('Verifier', 'validate claims, find contradictions, and mark uncertainty clearly.'),
    tags: ['research', 'verification']
  },
  {
    description: 'Turns findings into concise recommendations.',
    id: 'synthesizer',
    name: 'Synthesizer',
    profileId: 'synthesizer',
    soul: soul('Synthesizer', 'combine findings into short decisions, options, and next actions.'),
    tags: ['summary']
  },
  {
    description: 'Checks services, ports, config, and live state.',
    id: 'inspector',
    name: 'Inspector',
    profileId: 'inspector',
    soul: soul('Inspector', 'prove runtime truth with direct checks before proposing changes.'),
    tags: ['runtime']
  },
  {
    description: 'Plans and validates safe deploy steps.',
    id: 'deployer',
    name: 'Deployer',
    profileId: 'deployer',
    soul: soul('Deployer', 'prepare safe deployment steps, smoke tests, and rollback-aware validation.'),
    tags: ['deploy']
  },
  {
    description: 'Finds failed/error patterns and root causes.',
    id: 'log-analyst',
    name: 'Log Analyst',
    profileId: 'log-analyst',
    soul: soul('Log Analyst', 'summarize logs into root cause, impact, and exact next checks.'),
    tags: ['logs']
  },
  {
    description: 'Clarifies goals, scope, and acceptance criteria.',
    id: 'product-planner',
    name: 'Product Planner',
    profileId: 'product-planner',
    soul: soul('Product Planner', 'turn product ideas into scope, success criteria, and implementation phases.'),
    tags: ['product']
  },
  {
    description: 'Checks interaction design and empty/error states.',
    id: 'ux-reviewer',
    name: 'UX Reviewer',
    profileId: 'ux-reviewer',
    soul: soul('UX Reviewer', 'review flows, labels, empty states, error states, and visual clarity.'),
    tags: ['ux']
  },
  {
    description: 'Maps product/UI intent into concrete code changes.',
    id: 'implementation-agent',
    name: 'Implementation Agent',
    profileId: 'implementation-agent',
    soul: soul('Implementation Agent', 'translate approved specs into minimal implementation tasks.'),
    tags: ['implementation']
  }
]

export const BUILTIN_STUDIO_TEAM_PRESETS: StudioTeamPreset[] = [
  {
    agents: ['planner', 'coder', 'tester', 'reviewer'],
    description: 'Plan, implement, test, and review code changes with delegated profile specialists.',
    id: 'coding-team',
    instructions:
      'Use the planner for decomposition, coder for implementation, tester for verification, and reviewer for risks. Delegate with the listed profile_id values when parallel work helps.',
    name: 'Coding Team',
    tags: ['code', 'review', 'tests']
  },
  {
    agents: ['researcher', 'verifier', 'synthesizer'],
    description: 'Research a topic, verify sources, and synthesize an actionable summary.',
    id: 'research-team',
    instructions:
      'Delegate discovery, verification, and synthesis separately when the task benefits from independent research paths. Ask members to cite assumptions and unresolved gaps.',
    name: 'Research Team',
    tags: ['research', 'sources', 'summary']
  },
  {
    agents: ['inspector', 'deployer', 'log-analyst'],
    description: 'Inspect runtime state, deploy safely, and summarize service/log health.',
    id: 'runtime-ops-team',
    instructions:
      'Use the inspector for live state, deployer for rollout steps, and log analyst for failures. Preserve runtime truth over repo assumptions.',
    name: 'Runtime Ops Team',
    tags: ['runtime', 'deploy', 'logs']
  },
  {
    agents: ['product-planner', 'ux-reviewer', 'implementation-agent'],
    description: 'Shape product intent, UI details, implementation tasks, and acceptance checks.',
    id: 'product-studio-team',
    instructions:
      'Use product planning, UX review, and implementation perspectives to turn ambiguous requests into shippable Studio work.',
    name: 'Product Studio Team',
    tags: ['product', 'ux', 'studio']
  }
]

export function getStudioAgentPreset(presetId: string): StudioAgentPreset | null {
  return BUILTIN_STUDIO_AGENT_PRESETS.find(preset => preset.id === presetId) ?? null
}

export function getStudioTeamPreset(presetId: string): StudioTeamPreset | null {
  return BUILTIN_STUDIO_TEAM_PRESETS.find(preset => preset.id === presetId) ?? null
}

export function getStudioTeamPresetAgents(preset: StudioTeamPreset): StudioAgentPreset[] {
  return preset.agents.map(getStudioAgentPreset).filter((agent): agent is StudioAgentPreset => Boolean(agent))
}

export function getStudioTeamPresetForTeam(team: null | StudioTeam): StudioTeamPreset | null {
  if (!team) return null

  return BUILTIN_STUDIO_TEAM_PRESETS.find(preset => preset.name === team.name || team.name.startsWith(`${preset.name} `)) ?? null
}

export function studioTeamFromPreset(preset: StudioTeamPreset, name = uniquePresetTeamName(preset.name)): Omit<StudioTeam, 'id'> {
  return {
    description: preset.description,
    instructions: preset.instructions,
    name,
    profileIds: [...new Set(getStudioTeamPresetAgents(preset).map(agent => agent.profileId).filter(Boolean))]
  }
}

export function uniquePresetTeamName(name: string, existingNames = $studioTeams.get().map(team => team.name)): string {
  const base = name.trim() || 'Preset Team'
  const existing = new Set(existingNames.map(value => value.trim().toLowerCase()).filter(Boolean))

  if (!existing.has(base.toLowerCase())) return base

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} ${suffix}`

    if (!existing.has(candidate.toLowerCase())) return candidate
  }

  return `${base} ${Date.now()}`
}

export async function ensureStudioAgentPresetProfile(
  presetId: string,
  profiles: ProfileInfo[],
  client: StudioPresetProfileClient = DEFAULT_PROFILE_CLIENT
): Promise<StudioAgentPresetImportResult | null> {
  const preset = getStudioAgentPreset(presetId)

  if (!preset) return null

  const profileId = preset.profileId.trim()
  const exists = profiles.some(profile => profile.name === profileId)

  if (exists) return { created: false, preset, profileId }

  await client.createProfile({ name: profileId, clone_from: preset.cloneFrom ?? 'default' })
  await client.updateProfileSoul(profileId, preset.soul)

  return { created: true, preset, profileId }
}

export async function createStudioTeamFromPreset(
  presetId: string,
  profiles: ProfileInfo[] = [],
  client: StudioPresetProfileClient = DEFAULT_PROFILE_CLIENT
): Promise<StudioTeamPresetImportResult | null> {
  const preset = getStudioTeamPreset(presetId)

  if (!preset) return null

  const agents: StudioAgentPresetImportResult[] = []
  const nextProfiles = [...profiles]

  for (const agentPresetId of preset.agents) {
    const result = await ensureStudioAgentPresetProfile(agentPresetId, nextProfiles, client)

    if (!result) continue
    agents.push(result)
    if (result.created) {
      nextProfiles.push({ has_env: false, is_default: false, model: null, name: result.profileId, path: '', provider: null, skill_count: 0 })
    }
  }

  return { agents, team: createStudioTeam(studioTeamFromPreset(preset)) }
}

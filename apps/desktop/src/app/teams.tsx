import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, Save } from '@/lib/icons'
import { profileColorSoft, resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import { getProfiles } from '@/hermes'
import { notifyError } from '@/store/notifications'
import { $profileColors, refreshActiveProfile } from '@/store/profile'
import {
  $studioTeams,
  createStudioTeam,
  deleteStudioTeam,
  type StudioTeam,
  updateStudioTeam
} from '@/store/studio-teams'
import {
  BUILTIN_STUDIO_TEAM_PRESETS,
  createStudioTeamFromPreset,
  getStudioTeamPresetAgents
} from '@/store/studio-team-presets'
import type { ProfileInfo } from '@/types/hermes'

import {
  Panel,
  PanelAddButton,
  PanelBody,
  PanelDetail,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelListRow,
  PanelPill,
  PanelRowMenu,
  PanelSectionLabel
} from './overlays/panel'

interface TeamsViewProps {
  onClose: () => void
}

interface TeamDraft {
  description: string
  instructions: string
  name: string
  profileIds: string[]
}

function draftFromTeam(team: StudioTeam | null): TeamDraft {
  return {
    description: team?.description ?? '',
    instructions: team?.instructions ?? '',
    name: team?.name ?? '',
    profileIds: team?.profileIds ?? []
  }
}

function ProfileMemberChip({
  onToggle,
  profile,
  selected
}: {
  onToggle: (selected: boolean) => void
  profile: ProfileInfo
  selected: boolean
}) {
  const colors = useStore($profileColors)
  const color = resolveProfileColor(profile.name, colors)
  const hue = color ?? 'var(--ui-text-quaternary)'
  const initial =
    profile.name
      .replace(/[^a-z0-9]/gi, '')
      .charAt(0)
      .toUpperCase() || '?'

  return (
    <button
      aria-pressed={selected}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[0.78rem] transition-colors',
        selected
          ? 'border-primary/45 bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]'
          : 'border-border/65 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground'
      )}
      onClick={() => onToggle(!selected)}
      type="button"
    >
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center rounded-full text-[0.5rem] font-semibold uppercase leading-none"
        style={{ backgroundColor: profileColorSoft(hue, selected ? 30 : 22), color: color ?? undefined }}
      >
        {initial}
      </span>
      <span className="min-w-0 truncate font-medium">{profile.name}</span>
      {selected ? <Check className="size-3 shrink-0 text-primary" /> : null}
    </button>
  )
}

export function TeamsView({ onClose }: TeamsViewProps) {
  const teams = useStore($studioTeams)
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<null | StudioTeam>(null)
  const [presetGalleryOpen, setPresetGalleryOpen] = useState(false)
  const [importingPresetId, setImportingPresetId] = useState<null | string>(null)
  const [presetImportStatus, setPresetImportStatus] = useState('')
  const [selectedId, setSelectedId] = useState<null | string>(teams[0]?.id ?? null)
  const selected = selectedId ? (teams.find(team => team.id === selectedId) ?? null) : null
  const [draft, setDraft] = useState<TeamDraft>(() => draftFromTeam(selected))

  useEffect(() => {
    void getProfiles()
      .then(result => setProfiles(result.profiles))
      .catch(error => notifyError(error, 'Failed to load profiles'))
  }, [])

  useEffect(() => {
    if (selectedId === null) {
      return
    }

    setDraft(draftFromTeam(selected))
  }, [selected, selectedId])

  useEffect(() => {
    if (selectedId === null || teams.some(team => team.id === selectedId)) {
      return
    }

    const next = teams[0] ?? null
    setSelectedId(next?.id ?? null)
    setDraft(draftFromTeam(next))
  }, [selectedId, teams])

  const selectTeam = (team: StudioTeam) => {
    setSelectedId(team.id)
    setDraft(draftFromTeam(team))
  }

  const existingProfileNames = useMemo(() => new Set(profiles.map(profile => profile.name)), [profiles])
  const visibleTeams = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) return teams

    return teams.filter(team =>
      [team.name, team.description, team.instructions, ...team.profileIds].some(value =>
        value.toLowerCase().includes(needle)
      )
    )
  }, [query, teams])
  const normalizedDraft: TeamDraft = {
    description: draft.description.trim(),
    instructions: draft.instructions.trim(),
    name: draft.name.trim(),
    profileIds: [...new Set(draft.profileIds.filter(Boolean))]
  }
  const original = draftFromTeam(selected)
  const dirty = selectedId === null || normalizedDraft.name !== original.name || normalizedDraft.description !== original.description || normalizedDraft.instructions !== original.instructions || normalizedDraft.profileIds.join('\u0000') !== original.profileIds.join('\u0000')
  const duplicate = Boolean(
    normalizedDraft.name && teams.some(team => team.id !== selectedId && team.name.trim().toLowerCase() === normalizedDraft.name.toLowerCase())
  )
  const canSave = Boolean(normalizedDraft.name) && dirty && !duplicate

  const save = () => {
    if (!canSave) return

    if (selectedId) {
      updateStudioTeam(selectedId, normalizedDraft)
    } else {
      const created = createStudioTeam(normalizedDraft)
      setSelectedId(created.id)
    }
  }

  const createNew = () => {
    setSelectedId(null)
    setDraft({ description: '', instructions: '', name: 'New team', profileIds: [] })
  }

  const createFromPreset = async (presetId: string) => {
    setImportingPresetId(presetId)
    setPresetImportStatus('')

    try {
      const result = await createStudioTeamFromPreset(presetId, profiles)

      if (!result) return

      setProfiles(current => {
        const known = new Set(current.map(profile => profile.name))
        const createdProfiles = result.agents
          .filter(agent => agent.created && !known.has(agent.profileId))
          .map(agent => ({ has_env: false, is_default: false, model: null, name: agent.profileId, path: '', provider: null, skill_count: 0 }))

        return [...current, ...createdProfiles]
      })
      setSelectedId(result.team.id)
      setPresetImportStatus(`Team created with ${result.agents.length} agents`)
      setPresetGalleryOpen(false)
      await refreshActiveProfile()
    } catch (error) {
      notifyError(error, 'Failed to import team preset')
    } finally {
      setImportingPresetId(null)
    }
  }

  const removeTeam = (teamId: string) => {
    deleteStudioTeam(teamId)
    setPendingDelete(null)

    if (selectedId === teamId) {
      const next = teams.find(team => team.id !== teamId)
      setSelectedId(next?.id ?? null)
      if (!next) {
        setDraft(draftFromTeam(null))
      }
    }
  }

  const toggleProfile = (profileName: string, checked: boolean) => {
    setDraft(current => ({
      ...current,
      profileIds: checked
        ? [...new Set([...current.profileIds, profileName])]
        : current.profileIds.filter(value => value !== profileName)
    }))
  }

  return (
    <Panel closeLabel="Close teams" onClose={onClose}>
      <PanelHeader subtitle={`${teams.length} teams`} title="Teams" />
      <PanelBody>
        <PanelList
          onSearchChange={setQuery}
          searchLabel="Search teams"
          searchPlaceholder="Search teams"
          searchValue={query}
        >
          {visibleTeams.map(team => (
            <PanelListRow
              active={selected?.id === team.id}
              key={team.id}
              lead={<Codicon className="text-muted-foreground/70" name="organization" size="0.9rem" />}
              menu={
                <PanelRowMenu
                  items={[{ icon: 'trash', label: 'Delete', onSelect: () => setPendingDelete(team), tone: 'danger' }]}
                />
              }
              onSelect={() => selectTeam(team)}
              rowKey={team.id}
              title={team.name}
            />
          ))}
          <PanelAddButton label="New team" onClick={createNew} showLabel />
          <PanelAddButton icon="sparkle" label="From preset" onClick={() => setPresetGalleryOpen(true)} showLabel />
        </PanelList>

        {selected || selectedId === null ? (
          <PanelDetail>
            <header className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <PanelSectionLabel className="text-[0.7rem] tracking-[0.14em]">
                    {selectedId === null ? 'New team' : 'Team details'}
                  </PanelSectionLabel>
                  {dirty ? <p className="text-xs text-muted-foreground">Unsaved changes</p> : null}
                </div>
              </div>
              <Input
                aria-label="Team name"
                className="h-9 text-sm font-semibold"
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                value={draft.name}
              />
              <Input
                aria-label="Team description"
                className="h-9 text-sm"
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                placeholder="Short description"
                value={draft.description}
              />
              {duplicate ? <p className="text-xs text-destructive">A team with this name already exists.</p> : null}
            </header>

            <section className="space-y-2">
              <PanelSectionLabel>Members</PanelSectionLabel>
              <div className="flex flex-wrap gap-2">
                {profiles.map(profile => (
                  <ProfileMemberChip
                    key={profile.name}
                    onToggle={selected => toggleProfile(profile.name, selected)}
                    profile={profile}
                    selected={draft.profileIds.includes(profile.name)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <PanelSectionLabel>Instructions</PanelSectionLabel>
              <Textarea
                className="min-h-32 text-sm"
                onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))}
                placeholder="Tell the active profile how to use this team."
                value={draft.instructions}
              />
              <div className="flex justify-end">
                <Button disabled={!canSave} onClick={save} size="sm">
                  <Save />
                  Save
                </Button>
              </div>
            </section>
          </PanelDetail>
        ) : (
          <PanelEmpty description="Create a team from existing profiles." icon="organization" title="No team selected" />
        )}
      </PanelBody>
      <Dialog onOpenChange={open => !open && setPendingDelete(null)} open={pendingDelete !== null}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              {pendingDelete ? (
                <>
                  Delete <span className="font-medium text-foreground">{pendingDelete.name}</span>. Profiles are not deleted,
                  but session assignments using this team are cleared.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingDelete(null)} variant="outline">
              Cancel
            </Button>
            <Button disabled={!pendingDelete} onClick={() => pendingDelete && removeTeam(pendingDelete.id)} variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setPresetGalleryOpen} open={presetGalleryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start from a team preset</DialogTitle>
            <DialogDescription>
              Presets are copied into your teams. You can edit the copied team without changing the preset.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {BUILTIN_STUDIO_TEAM_PRESETS.map(preset => {
              const agents = getStudioTeamPresetAgents(preset)

              return (
                <article className="rounded-lg border border-border/70 bg-muted/20 p-3" key={preset.id}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{preset.name}</h3>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {agents.map(member => (
                      <div className="rounded border border-border/60 bg-background/60 p-2" key={`${preset.id}-${member.profileId}`}>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                          <span>{member.name}</span>
                          <PanelPill tone={existingProfileNames.has(member.profileId) ? 'good' : 'muted'}>{member.profileId}</PanelPill>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{member.description}</p>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-3 w-full" disabled={importingPresetId !== null} onClick={() => void createFromPreset(preset.id)} size="sm">
                    {importingPresetId === preset.id ? 'Creating…' : 'Use preset'}
                  </Button>
                </article>
              )
            })}
          </div>
          {presetImportStatus ? <p className="text-xs text-muted-foreground">{presetImportStatus}</p> : null}
        </DialogContent>
      </Dialog>
    </Panel>
  )
}

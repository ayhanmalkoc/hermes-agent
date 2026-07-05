import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Save } from '@/lib/icons'
import { getProfiles } from '@/hermes'
import { notifyError } from '@/store/notifications'
import {
  $studioTeams,
  createStudioTeam,
  deleteStudioTeam,
  type StudioTeam,
  updateStudioTeam
} from '@/store/studio-teams'
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

export function TeamsView({ onClose }: TeamsViewProps) {
  const teams = useStore($studioTeams)
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<null | StudioTeam>(null)
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

    setSelectedId(teams[0]?.id ?? null)
  }, [selectedId, teams])

  const profileNames = useMemo(() => new Set(profiles.map(profile => profile.name)), [profiles])
  const missingProfiles = draft.profileIds.filter(profileId => !profileNames.has(profileId))
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
              onSelect={() => setSelectedId(team.id)}
              rowKey={team.id}
              title={team.name}
            />
          ))}
          <PanelAddButton label="New team" onClick={createNew} />
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
                <Button disabled={!canSave} onClick={save} size="sm">
                  <Save />
                  Save
                </Button>
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
              <div className="grid gap-2">
                {profiles.map(profile => (
                  <label className="flex items-center gap-2 text-sm" key={profile.name}>
                    <Checkbox
                      checked={draft.profileIds.includes(profile.name)}
                      onCheckedChange={checked => toggleProfile(profile.name, checked === true)}
                    />
                    <span>{profile.name}</span>
                    {profile.is_default && <PanelPill tone="good">default</PanelPill>}
                  </label>
                ))}
                {missingProfiles.map(profileId => (
                  <div className="flex items-center gap-2 text-sm text-destructive" key={profileId}>
                    <Codicon name="warning" size="0.9rem" /> Missing profile: {profileId}
                  </div>
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
    </Panel>
  )
}

import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  const [selectedId, setSelectedId] = useState<null | string>(teams[0]?.id ?? null)
  const selected = teams.find(team => team.id === selectedId) ?? teams[0] ?? null
  const [draft, setDraft] = useState<TeamDraft>(() => draftFromTeam(selected))

  useEffect(() => {
    void getProfiles()
      .then(result => setProfiles(result.profiles))
      .catch(error => notifyError(error, 'Failed to load profiles'))
  }, [])

  useEffect(() => {
    setDraft(draftFromTeam(selected))
  }, [selected])

  const profileNames = useMemo(() => new Set(profiles.map(profile => profile.name)), [profiles])
  const missingProfiles = draft.profileIds.filter(profileId => !profileNames.has(profileId))

  const save = () => {
    const name = draft.name.trim()

    if (!name) return

    const payload = {
      description: draft.description.trim(),
      instructions: draft.instructions.trim(),
      name,
      profileIds: [...new Set(draft.profileIds.filter(Boolean))]
    }

    if (selected) {
      updateStudioTeam(selected.id, payload)
    } else {
      const created = createStudioTeam(payload)
      setSelectedId(created.id)
    }
  }

  const createNew = () => {
    setSelectedId(null)
    setDraft({ description: '', instructions: '', name: 'New team', profileIds: [] })
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
        <PanelList searchLabel="Search teams" searchPlaceholder="Search teams" searchValue="">
          {teams.map(team => (
            <PanelListRow
              active={selected?.id === team.id}
              key={team.id}
              lead={<Codicon className="text-muted-foreground/70" name="organization" size="0.9rem" />}
              menu={
                <PanelRowMenu
                  items={[{ icon: 'trash', label: 'Delete', onSelect: () => deleteStudioTeam(team.id), tone: 'danger' }]}
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
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Team name"
                  className="h-9 text-sm font-semibold"
                  onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                  value={draft.name}
                />
                <Button disabled={!draft.name.trim()} onClick={save} size="sm">
                  Save
                </Button>
              </div>
              <Input
                aria-label="Team description"
                className="h-9 text-sm"
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                placeholder="Short description"
                value={draft.description}
              />
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
    </Panel>
  )
}

import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { HermesGateway } from '@/hermes'
import { profileColorSoft, resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile, $profileColors, $profiles, normalizeProfileKey, selectProfile } from '@/store/profile'
import { $studioTeamAssignments, $studioTeams, setStudioTeamForSessions } from '@/store/studio-teams'

interface StudioTeamButtonProps {
  className?: string
  gateway?: HermesGateway | null
  sessionId?: null | string
  storedSessionId?: null | string
}

const NO_TEAM = '__none__'

function ProfileInitial({ color, name }: { color: null | string; name: string }) {
  const hue = color ?? 'var(--ui-text-quaternary)'
  const initial =
    name
      .replace(/[^a-z0-9]/gi, '')
      .charAt(0)
      .toUpperCase() || '?'

  return (
    <span
      aria-hidden="true"
      className="grid size-4 shrink-0 place-items-center rounded-[3px] text-[0.5rem] font-semibold uppercase leading-none"
      style={{ backgroundColor: profileColorSoft(hue, 26), color: color ?? undefined }}
    >
      {initial}
    </span>
  )
}

export function StudioTeamButton({ className, gateway, sessionId, storedSessionId }: StudioTeamButtonProps) {
  const teams = useStore($studioTeams)
  const assignments = useStore($studioTeamAssignments)
  const key = sessionId?.trim() || 'draft'
  const value = assignments[key] ?? NO_TEAM
  const hasTeamValue = value !== NO_TEAM

  if (!teams.length) {
    return null
  }

  return (
    <Select
      onValueChange={next => {
        void setStudioTeamForSessions(
          [sessionId, storedSessionId],
          next === NO_TEAM ? null : next,
          gateway?.request.bind(gateway)
        )
      }}
      value={value}
    >
      <SelectTrigger
        aria-label="Team"
        className={cn(
          'group relative h-7 w-auto px-2 text-xs transition-colors',
          hasTeamValue
            ? 'rounded-[8px] border-transparent bg-primary/[0.06] hover:bg-primary/10 data-[state=open]:bg-primary/10'
            : 'rounded-[8px] border-transparent bg-muted/20 hover:bg-muted/30 data-[state=open]:bg-muted/30',
          className
        )}
        title="Team"
      >
        <span
          aria-hidden
          className={hasTeamValue ? 'arc-border arc-reverse arc-nous' : 'arc-border arc-muted'}
          key={`team-arc-${value}`}
        />
        <span className="relative z-10 flex min-w-0 items-center gap-2">
          <Codicon aria-hidden="true" name="organization" size="0.9rem" />
          <SelectValue placeholder="Team" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TEAM}>No team</SelectItem>
        {teams.map(team => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function StudioAgentButton({ className }: { className?: string }) {
  const profiles = useStore($profiles)
  const activeProfile = normalizeProfileKey(useStore($activeGatewayProfile))
  const colors = useStore($profileColors)
  const active = profiles.find(profile => normalizeProfileKey(profile.name) === activeProfile) ?? profiles.find(profile => profile.is_default) ?? null

  if (!profiles.length || !active) {
    return null
  }

  return (
    <Select onValueChange={selectProfile} value={active.name}>
      <SelectTrigger
        aria-label="Agent"
        className={cn(
          'group relative h-7 w-auto rounded-[8px] border-transparent bg-primary/[0.06] px-2 text-xs transition-colors hover:bg-primary/10 data-[state=open]:bg-primary/10',
          className
        )}
        title="Agent"
      >
        <span aria-hidden className="arc-border arc-reverse arc-nous" key={`agent-arc-${active.name}`} />
        <span className="relative z-10 flex min-w-0 items-center gap-2">
          {active.is_default ? (
            <Codicon aria-hidden="true" className="text-muted-foreground/80" name="home" size="0.9rem" />
          ) : (
            <ProfileInitial color={resolveProfileColor(active.name, colors)} name={active.name} />
          )}
          <SelectValue placeholder="Agent" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {profiles.map(profile => (
          <SelectItem key={profile.name} value={profile.name}>
            {profile.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

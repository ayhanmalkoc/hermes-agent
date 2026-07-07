import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { HermesGateway } from '@/hermes'
import { profileColorSoft, resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import {
  $activeGatewayProfile,
  $profileColors,
  $profileOrder,
  $profiles,
  normalizeProfileKey,
  selectProfile,
  sortByProfileOrder
} from '@/store/profile'
import { $studioTeamAssignments, $studioTeams, setStudioTeamForSessions } from '@/store/studio-teams'
import type { ProfileInfo } from '@/types/hermes'

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

interface AgentProfileRailProps {
  className?: string
}

export function AgentProfileRail({ className }: AgentProfileRailProps) {
  const profiles = useStore($profiles)
  const activeProfile = normalizeProfileKey(useStore($activeGatewayProfile))
  const order = useStore($profileOrder)
  const colors = useStore($profileColors)
  const ordered = orderProfilesForComposer(profiles, order)
  const activeIndex = Math.max(
    0,
    ordered.findIndex(profile => normalizeProfileKey(profile.name) === activeProfile)
  )
  const active = ordered[activeIndex] ?? ordered.find(profile => profile.is_default) ?? null
  const left = ordered.slice(0, activeIndex)
  const right = ordered.slice(activeIndex + 1)

  if (!profiles.length || !active) {
    return null
  }

  return (
    <div className={cn('pointer-events-none relative grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] px-8', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background/70 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background/70 to-transparent"
      />
      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {left.map(profile => (
          <AgentProfileRailButton
            active={false}
            color={resolveProfileColor(profile.name, colors)}
            key={profile.name}
            profile={profile}
          />
        ))}
      </div>
      <div className="flex justify-center px-1">
        <AgentProfileRailButton active color={resolveProfileColor(active.name, colors)} profile={active} />
      </div>
      <div className="flex min-w-0 items-center justify-start gap-2 overflow-x-auto pl-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {right.map(profile => (
          <AgentProfileRailButton
            active={false}
            color={resolveProfileColor(profile.name, colors)}
            key={profile.name}
            profile={profile}
          />
        ))}
      </div>
    </div>
  )
}

function orderProfilesForComposer(profiles: ProfileInfo[], order: string[]): ProfileInfo[] {
  const defaultProfile = profiles.find(profile => profile.is_default)
  const named = sortByProfileOrder(
    profiles.filter(profile => !profile.is_default),
    order
  )

  return defaultProfile ? [defaultProfile, ...named] : named
}

function AgentProfileRailButton({ active, color, profile }: { active: boolean; color: null | string; profile: ProfileInfo }) {
  const hue = color ?? 'var(--ui-text-quaternary)'

  return (
    <button
      aria-label={profile.name}
      aria-pressed={active}
      className={cn(
        'group/profile relative flex h-7 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-xs transition-all duration-150',
        active
          ? 'pointer-events-auto min-w-0 max-w-42 gap-2 bg-primary/[0.06] px-2 text-foreground shadow-sm hover:bg-primary/10'
          : 'pointer-events-auto size-6 text-muted-foreground/70 opacity-65 hover:bg-muted/30 hover:text-foreground hover:opacity-100'
      )}
      onClick={event => {
        event.stopPropagation()
        selectProfile(profile.name)
      }}
      onPointerDown={event => event.stopPropagation()}
      title={profile.name}
      type="button"
    >
      {active && <span aria-hidden className="arc-border arc-reverse arc-nous" key={`agent-rail-arc-${profile.name}`} />}
      <span className="relative z-10 flex min-w-0 items-center justify-center gap-2">
        {profile.is_default ? (
          <Codicon aria-hidden="true" className="text-muted-foreground/80" name="home" size="0.9rem" />
        ) : (
          <ProfileInitial color={color} name={profile.name} />
        )}
        {active && <span className="min-w-0 truncate">{profile.name}</span>}
      </span>
      {!active && !profile.is_default && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] opacity-0 transition-opacity group-hover/profile:opacity-100"
          style={{ boxShadow: `inset 0 0 0 1px ${hue}` }}
        />
      )}
    </button>
  )
}

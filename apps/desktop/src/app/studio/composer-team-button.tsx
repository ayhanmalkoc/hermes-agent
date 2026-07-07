import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { HermesGateway } from '@/hermes'
import { cn } from '@/lib/utils'
import { $studioTeamAssignments, $studioTeams, setStudioTeamForSessions } from '@/store/studio-teams'

interface StudioTeamButtonProps {
  className?: string
  gateway?: HermesGateway | null
  sessionId?: null | string
  storedSessionId?: null | string
}

const NO_TEAM = '__none__'

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

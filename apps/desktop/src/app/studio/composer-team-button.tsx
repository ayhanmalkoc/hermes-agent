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
  const selectedTeam = value === NO_TEAM ? null : teams.find(team => team.id === value) ?? null

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
          'relative h-7 w-auto overflow-hidden px-2 text-xs transition-colors',
          selectedTeam
            ? 'rounded-[8px] bg-primary/[0.06] hover:bg-primary/10 data-[state=open]:bg-primary/10'
            : 'rounded-full',
          className
        )}
        title="Team"
      >
        {selectedTeam ? <span aria-hidden className="arc-border arc-reverse arc-nous" /> : null}
        <Codicon aria-hidden="true" name="organization" size="0.9rem" />
        <SelectValue placeholder="Team" />
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

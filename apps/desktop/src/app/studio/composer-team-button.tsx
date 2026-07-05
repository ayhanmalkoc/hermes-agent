import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { $studioTeamAssignments, $studioTeams, setStudioTeamForSession } from '@/store/studio-teams'

interface StudioTeamButtonProps {
  className?: string
  sessionId?: null | string
}

const NO_TEAM = '__none__'

export function StudioTeamButton({ className, sessionId }: StudioTeamButtonProps) {
  const teams = useStore($studioTeams)
  const assignments = useStore($studioTeamAssignments)
  const key = sessionId?.trim() || 'draft'
  const value = assignments[key] ?? NO_TEAM

  if (!teams.length) {
    return null
  }

  return (
    <Select
      onValueChange={next => setStudioTeamForSession(sessionId, next === NO_TEAM ? null : next)}
      value={value}
    >
      <SelectTrigger
        aria-label="Team"
        className={cn('h-7 w-auto min-w-32 rounded-full px-2 text-xs', className)}
        title="Team"
      >
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

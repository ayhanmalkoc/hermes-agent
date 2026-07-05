import { useStore } from '@nanostores/react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { $studioTeamAssignments, $studioTeams, setStudioTeamForSession } from '@/store/studio-teams'

interface StudioTeamButtonProps {
  sessionId?: null | string
}

const NO_TEAM = '__none__'

export function StudioTeamButton({ sessionId }: StudioTeamButtonProps) {
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
      <SelectTrigger aria-label="Team" className="h-8 max-w-40 rounded-full px-2 text-xs">
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

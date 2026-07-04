import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  $studioAgents,
  $studioModeEnabled,
  $studioRunContext,
  $studioTeams,
  $studioWorks,
  selectStudioAgent,
  selectStudioTeam,
  selectStudioWork,
  toggleStudioGoal
} from '@/store/studio'

function SelectChip({
  label,
  value,
  values,
  onChange
}: {
  label: string
  value?: string
  values: { id: string; name: string }[]
  onChange: (id: string | undefined) => void
}) {
  return (
    <label className="flex min-w-0 items-center gap-1 rounded-full border border-(--ui-stroke-tertiary) bg-(--ui-control-background) px-2 py-1 text-[0.68rem] text-(--ui-text-secondary)">
      <span className="shrink-0 text-(--ui-text-tertiary)">{label}</span>
      <select
        aria-label={label}
        className="min-w-0 max-w-32 bg-transparent text-foreground outline-none"
        onChange={event => onChange(event.target.value || undefined)}
        value={value ?? ''}
      >
        <option value="">Any</option>
        {values.map(item => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function StudioComposerChipBar() {
  const enabled = useStore($studioModeEnabled)
  const agents = useStore($studioAgents)
  const teams = useStore($studioTeams)
  const works = useStore($studioWorks)
  const context = useStore($studioRunContext)
  const workOptions = works.map(work => ({ id: work.id, name: work.title }))

  if (!enabled) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-surface-elevated-background)/70 px-2 py-1.5">
      <span className="shrink-0 text-[0.68rem] font-medium text-(--ui-text-tertiary)">Studio</span>
      <SelectChip label="Work" onChange={selectStudioWork} value={context.workId} values={workOptions} />
      <Button
        aria-pressed={context.goalEnabled}
        className={cn(
          'h-6 rounded-full px-2 text-[0.68rem]',
          context.goalEnabled && 'border-primary/40 bg-primary/15 text-foreground'
        )}
        onClick={toggleStudioGoal}
        size="sm"
        type="button"
        variant="outline"
      >
        Goal {context.goalEnabled ? 'on' : 'off'}
      </Button>
      <SelectChip label="Team" onChange={selectStudioTeam} value={context.teamIds[0]} values={teams} />
      <SelectChip label="Agent" onChange={selectStudioAgent} value={context.activeAgentId} values={agents} />
      {context.modelOverride && <span className="text-[0.68rem] text-(--ui-text-tertiary)">Model: {context.modelOverride}</span>}
      {context.toolset && <span className="text-[0.68rem] text-(--ui-text-tertiary)">Toolset: {context.toolset}</span>}
    </div>
  )
}

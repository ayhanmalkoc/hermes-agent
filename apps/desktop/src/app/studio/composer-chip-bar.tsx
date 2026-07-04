import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { $studioModeEnabled, $studioRunContext, toggleStudioGoal } from '@/store/studio'

export function StudioComposerChipBar() {
  const enabled = useStore($studioModeEnabled)
  const context = useStore($studioRunContext)

  if (!enabled) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-surface-elevated-background)/70 px-2 py-1.5">
      <span className="shrink-0 text-[0.68rem] font-medium text-(--ui-text-tertiary)">Studio</span>
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
    </div>
  )
}

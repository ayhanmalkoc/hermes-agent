import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { Goal, iconSize } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $studioModeEnabled, $studioRunContext, toggleStudioGoal } from '@/store/studio'

import { GHOST_ICON_BTN } from '../chat/composer/controls'

export function StudioGoalButton() {
  const enabled = useStore($studioModeEnabled)
  const context = useStore($studioRunContext)

  if (!enabled) {
    return null
  }

  const label = context.goalEnabled ? 'Goal on' : 'Goal off'

  return (
    <Tip label={label} side="top">
      <Button
        aria-label={label}
        aria-pressed={context.goalEnabled}
        className={cn(GHOST_ICON_BTN, 'p-0', context.goalEnabled && 'bg-(--chrome-action-hover) text-foreground')}
        onClick={toggleStudioGoal}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Goal className={cn(iconSize.sm, context.goalEnabled ? 'opacity-100' : 'opacity-70')} />
      </Button>
    </Tip>
  )
}

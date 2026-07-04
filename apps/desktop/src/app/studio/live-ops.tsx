import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { $approvalRequest } from '@/store/prompts'
import {
  $studioLiveOpsTab,
  $studioRunContext,
  setStudioLiveOpsTab,
  type StudioLiveOpsTab
} from '@/store/studio'

const tabs: { id: StudioLiveOpsTab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'subagents', label: 'Subagents' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'goal', label: 'Goal' }
]

export function StudioLiveOps({ onOpenTerminal }: { onOpenTerminal: () => void }) {
  const activeTab = useStore($studioLiveOpsTab)
  const context = useStore($studioRunContext)
  const approvalRequest = useStore($approvalRequest)

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background)">
      <div className="border-b border-(--ui-stroke-tertiary) px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ui-text-tertiary)">Studio Live Ops</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              className={cn('h-7 px-2 text-xs', activeTab === tab.id && 'bg-(--ui-control-active-background)')}
              onClick={() => setStudioLiveOpsTab(tab.id)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-(--ui-text-secondary)">
        {activeTab === 'live' && <Panel title="Live">Active session tool activity appears here as Studio matures.</Panel>}
        {activeTab === 'approvals' && (
          <Panel title="Approvals">
            {approvalRequest ? 'Approval waiting in the primary inline chat surface.' : 'No pending approvals.'}
          </Panel>
        )}
        {activeTab === 'subagents' && (
          <Panel title="Subagents">
            {context.agentIds.length ? `${context.agentIds.length} Studio agent context selected.` : 'No active subagent run.'}
          </Panel>
        )}
        {activeTab === 'terminal' && (
          <Panel title="Terminal">
            <Button className="mt-2" onClick={onOpenTerminal} size="sm" type="button" variant="outline">
              Open terminal
            </Button>
          </Panel>
        )}
        {activeTab === 'goal' && (
          <Panel title="Goal">{context.goalEnabled ? 'Goal chip is on; next submit uses /goal.' : 'Goal chip is off.'}</Panel>
        )}
      </div>
    </aside>
  )
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-surface-elevated-background) p-3">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="mt-2 text-xs leading-5">{children}</div>
    </section>
  )
}

import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  $studioAgents,
  $studioModeEnabled,
  $studioRunContext,
  $studioTeams,
  setStudioModeEnabled,
  toggleStudioGoal
} from '@/store/studio'

export function StudioView() {
  const enabled = useStore($studioModeEnabled)
  const agents = useStore($studioAgents)
  const teams = useStore($studioTeams)
  const context = useStore($studioRunContext)

  return (
    <section className="flex h-full min-h-0 flex-col bg-(--ui-background) text-foreground">
      <div className="border-b border-(--ui-stroke-tertiary) px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-(--ui-text-tertiary)">Experimental</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Studio Mode</h1>
            <p className="mt-2 max-w-2xl text-sm text-(--ui-text-secondary)">
              Agent and team context for Hermes sessions. Execution still uses the existing chat, goal, approval,
              tools, and subagent runtime.
            </p>
          </div>
          <Button onClick={() => setStudioModeEnabled(!enabled)} type="button" variant={enabled ? 'default' : 'outline'}>
            Studio {enabled ? 'on' : 'off'}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-6 lg:grid-cols-3">
        <StudioCard title="Start Surface">
          <p className="text-sm text-(--ui-text-secondary)">
            Use the normal chat composer. Studio adds Goal, Team, Agent, Model, and Toolset context above the
            existing input.
          </p>
          <div className="mt-4 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-surface-elevated-background) p-3 text-xs text-(--ui-text-secondary)">
            Goal chip {context.goalEnabled ? 'routes the next message through /goal.' : 'is off; messages use prompt.submit.'}
          </div>
          <Button className="mt-4" onClick={toggleStudioGoal} type="button" variant="outline">
            Toggle Goal chip
          </Button>
        </StudioCard>

        <StudioCard title="Teams">
          <StudioMetric label="Teams" value={teams.length} />
          {teams.map(team => (
            <div key={team.id} className="mt-3 rounded-lg border border-(--ui-stroke-tertiary) p-3">
              <div className="text-sm font-medium">{team.name}</div>
              <div className="mt-1 text-xs text-(--ui-text-tertiary)">
                {team.memberAgentIds.length} agents · {team.policy}
              </div>
            </div>
          ))}
        </StudioCard>

        <StudioCard title="Agents">
          <StudioMetric label="Agents" value={agents.length} />
          {agents.map(agent => (
            <div key={agent.id} className="mt-3 rounded-lg border border-(--ui-stroke-tertiary) p-3">
              <div className="text-sm font-medium">{agent.name}</div>
              <div className="mt-1 line-clamp-2 text-xs text-(--ui-text-tertiary)">{agent.role}</div>
            </div>
          ))}
        </StudioCard>

        <StudioCard title="Sessions">
          <p className="text-sm text-(--ui-text-secondary)">
            Studio uses the existing Hermes session list and project/workspace grouping. No extra Work layer.
          </p>
        </StudioCard>

        <StudioCard title="Runtime Contract">
          <ul className="space-y-2 text-sm text-(--ui-text-secondary)">
            <li>• Team sessions start at the parent AIAgent.</li>
            <li>• Subagents are used through existing delegation.</li>
            <li>• Goal chip uses the existing /goal loop.</li>
            <li>• Approval stays primary inline, with Live Ops as mirror.</li>
          </ul>
        </StudioCard>
      </div>
    </section>
  )
}

function StudioCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-surface-elevated-background) p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  )
}

function StudioMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-(--ui-control-background) px-3 py-2">
      <span className="text-xs text-(--ui-text-tertiary)">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  )
}

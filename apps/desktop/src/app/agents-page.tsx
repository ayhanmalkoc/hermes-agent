import { Codicon } from '@/components/ui/codicon'

export function AgentsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-(--ui-chat-surface-background) text-(--ui-text-primary)">
      <header className="flex h-(--titlebar-height) shrink-0 items-center border-b border-(--ui-stroke-tertiary) px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Codicon className="text-(--ui-text-tertiary)" name="hubot" />
          <h1 className="truncate text-sm font-semibold">Agents</h1>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) p-5 text-center shadow-sm">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-(--ui-control-background) text-(--ui-text-tertiary)">
            <Codicon name="hubot" />
          </div>
          <h2 className="text-sm font-semibold">Agent management is coming next</h2>
          <p className="mt-2 text-sm leading-5 text-(--ui-text-tertiary)">
            Studio agents will use existing Hermes sessions and subagents. No new backend layer is active here yet.
          </p>
        </div>
      </main>
    </div>
  )
}

import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { useElapsedSeconds } from '@/components/chat/activity-timer'
import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { Codicon } from '@/components/ui/codicon'
import { FadeText } from '@/components/ui/fade-text'
import { GlyphSpinner } from '@/components/ui/glyph-spinner'
import { type Translations, useI18n } from '@/i18n'
import { AlertCircle, CheckCircle2 } from '@/lib/icons'
import { useEnterAnimation } from '@/lib/use-enter-animation'
import { cn } from '@/lib/utils'
import { getSessionMessages } from '@/hermes'
import {
  $subagentsBySession,
  buildSubagentTree,
  type SubagentNode,
  type SubagentStatus,
  type SubagentStreamEntry
} from '@/store/subagents'
import type { GatewayRequester } from '@/lib/yolo-session'
import type { SessionMessage } from '@/types/hermes'

import { Panel, PanelHeader } from '../overlays/panel'

// Mirrors statusGlyph() in tool-fallback.tsx so subagent rows speak the
// same visual vocabulary as the chat tool blocks.
function statusGlyph(status: SubagentStatus, a: Translations['agents']): ReactNode {
  if (status === 'running' || status === 'queued') {
    return (
      <GlyphSpinner
        ariaLabel={a.running}
        className="size-3.5 shrink-0 text-[0.95rem] text-muted-foreground/80"
        spinner="breathe"
      />
    )
  }

  if (status === 'failed' || status === 'interrupted') {
    return <AlertCircle aria-label={a.failed} className="size-3.5 shrink-0 text-destructive" />
  }

  return <CheckCircle2 aria-label={a.done} className="size-3.5 shrink-0 text-emerald-600/85 dark:text-emerald-400/85" />
}

const STREAM_TONE: Record<SubagentStreamEntry['kind'], string> = {
  progress: 'text-muted-foreground/75',
  summary: 'text-foreground/85',
  thinking: 'text-muted-foreground/80',
  tool: 'text-foreground/85'
}

function streamGlyph(entry: SubagentStreamEntry): ReactNode {
  if (entry.isError) {
    return <AlertCircle aria-hidden className="mt-0.5 size-3 shrink-0 text-destructive" />
  }

  if (entry.kind === 'tool') {
    return <span aria-hidden className="mt-0.5 size-1.5 shrink-0 rounded-full bg-foreground/55" />
  }

  if (entry.kind === 'summary') {
    return <CheckCircle2 aria-hidden className="mt-0.5 size-3 shrink-0 text-emerald-600/85 dark:text-emerald-400/85" />
  }

  if (entry.kind === 'thinking') {
    return (
      <span aria-hidden className="font-mono text-[0.7rem] leading-none text-muted-foreground/70">
        …
      </span>
    )
  }

  return <span aria-hidden className="mt-0.5 size-1 shrink-0 rounded-full bg-muted-foreground/55" />
}

interface SubagentsViewProps {
  onClose: () => void
  runtimeSessionId: null | string
  storedSessionId: null | string
  requestGateway: GatewayRequester
}

interface StudioAgentRun {
  id: string
  title?: string
  started_at?: number
  updated_at?: number
  model?: string
  profile_id?: string
  profile_name?: string
  summary?: string
  message_count?: number
}

const isRunningStatus = (status: SubagentStatus) => status === 'running' || status === 'queued'

function messageText(message: SessionMessage): string {
  const content = message.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object') {
          const record = part as Record<string, unknown>

          return String(record.text ?? record.content ?? '')
        }

        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return typeof message.text === 'string' ? message.text : ''
}

function mergeRuns(lists: StudioAgentRun[][]): StudioAgentRun[] {
  const seen = new Set<string>()
  const merged: StudioAgentRun[] = []

  for (const runs of lists) {
    for (const run of runs) {
      if (!run.id || seen.has(run.id)) continue
      seen.add(run.id)
      merged.push(run)
    }
  }

  return merged.sort((a, b) => (b.updated_at ?? b.started_at ?? 0) - (a.updated_at ?? a.started_at ?? 0))
}

export function SubagentsView({ onClose, runtimeSessionId, storedSessionId, requestGateway }: SubagentsViewProps) {
  const { t } = useI18n()
  const subagentsBySession = useStore($subagentsBySession)
  const [runs, setRuns] = useState<StudioAgentRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [selectedRun, setSelectedRun] = useState<StudioAgentRun | null>(null)
  const [replayMessages, setReplayMessages] = useState<SessionMessage[]>([])
  const [loadingReplay, setLoadingReplay] = useState(false)

  const activeSessionItems = runtimeSessionId ? (subagentsBySession[runtimeSessionId] ?? []) : []
  const hydrateSessionIds = useMemo(
    () => [...new Set([storedSessionId, runtimeSessionId].map(id => id?.trim()).filter((id): id is string => Boolean(id)))],
    [runtimeSessionId, storedSessionId]
  )
  const hydrateKey = useMemo(
    () =>
      [
        hydrateSessionIds.join(','),
        runtimeSessionId ?? '',
        activeSessionItems.length,
        ...activeSessionItems.map(item => `${item.id}:${item.status}:${item.updatedAt}`)
      ].join('|'),
    [activeSessionItems, hydrateSessionIds, runtimeSessionId]
  )
  const activeSessionTree = useMemo(() => buildSubagentTree(activeSessionItems), [activeSessionItems])
  const activeSessionFlat = useMemo(() => flatten(activeSessionTree), [activeSessionTree])
  const runningTree = useMemo(
    () => buildSubagentTree(activeSessionFlat.filter(node => isRunningStatus(node.status))),
    [activeSessionFlat]
  )
  const completedLive = useMemo(
    () => activeSessionFlat.filter(node => !isRunningStatus(node.status) && node.sessionId),
    [activeSessionFlat]
  )
  const completedIds = useMemo(() => new Set(completedLive.map(node => node.sessionId).filter(Boolean)), [completedLive])
  const completedRuns = useMemo(
    () => runs.filter(run => !completedIds.has(run.id)),
    [completedIds, runs]
  )

  useEffect(() => {
    if (!hydrateSessionIds.length) {
      setRuns([])
      setRunsLoading(false)
      return
    }

    let cancelled = false
    setRunsLoading(true)

    Promise.all(
      hydrateSessionIds.map(sessionId =>
        requestGateway<{ runs?: StudioAgentRun[] }>('studio.agent_runs', { parent_session_id: sessionId })
          .then(result => (Array.isArray(result.runs) ? result.runs : []))
          .catch(() => [])
      )
    )
      .then(results => {
        if (!cancelled) {
          setRuns(mergeRuns(results))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRunsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hydrateKey, hydrateSessionIds, requestGateway])

  const openReplay = async (run: StudioAgentRun) => {
    setSelectedRun(run)
    setReplayMessages([])
    setLoadingReplay(true)

    try {
      const result = await getSessionMessages(run.id)
      setReplayMessages(result.messages ?? [])
    } catch {
      setReplayMessages([])
    } finally {
      setLoadingReplay(false)
    }
  }

  if (selectedRun) {
    return (
      <Panel closeLabel={t.agents.close} onClose={onClose}>
        <PanelHeader subtitle={selectedRun.id} title={selectedRun.profile_name || selectedRun.profile_id || 'Agent Run'} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <button
            className="w-fit rounded-md border border-border/60 px-2 py-1 text-[0.68rem] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            onClick={() => setSelectedRun(null)}
            type="button"
          >
            ← Live Agents
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-selectable-text="true">
            {loadingReplay ? (
              <p className="text-sm text-muted-foreground">Loading run…</p>
            ) : replayMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript found.</p>
            ) : (
              <div className="grid gap-3">
                {replayMessages.map((message, index) => {
                  const text = messageText(message)

                  if (!text) {
                    return null
                  }

                  return (
                    <article className="rounded-xl border border-border/55 bg-muted/20 p-3" key={`${message.role}:${index}`}>
                      <p className="mb-1 text-[0.62rem] font-medium uppercase tracking-wider text-muted-foreground/65">
                        {message.role}
                      </p>
                      <p className="whitespace-pre-wrap text-[0.78rem] leading-relaxed text-foreground/85">{text}</p>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel closeLabel={t.agents.close} onClose={onClose}>
      <PanelHeader subtitle={t.agents.subtitle} title={t.agents.title} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
        <section className="min-h-0 min-w-0">
          <p className="mb-2 text-[0.66rem] font-medium uppercase tracking-wider text-muted-foreground/70">Running</p>
          {runningTree.length > 0 ? <SubagentTree tree={runningTree} /> : <p className="text-xs text-muted-foreground/65">No running agents.</p>}
        </section>
        <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <p className="mb-2 text-[0.66rem] font-medium uppercase tracking-wider text-muted-foreground/70">Completed</p>
          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-3">
              {completedLive.map(node => (
                <CompletedNodeRow key={node.id} node={node} nowMs={Date.now()} onOpen={openReplay} />
              ))}
              {completedRuns.map(run => (
                <CompletedRunRow key={run.id} onOpen={openReplay} run={run} />
              ))}
              {runsLoading && completedLive.length === 0 && completedRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground/65">Loading completed runs…</p>
              ) : null}
              {completedLive.length === 0 && completedRuns.length === 0 && !runsLoading ? (
                <p className="text-xs text-muted-foreground/65">No completed runs for this session.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </Panel>
  )
}

const fmtDuration = (seconds: number | undefined, a: Translations['agents']) => {
  if (!seconds || seconds <= 0) {
    return ''
  }

  if (seconds < 60) {
    return a.durationSeconds(seconds.toFixed(1))
  }

  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)

  return a.durationMinutes(m, s)
}

const fmtTokens = (value: number | undefined, a: Translations['agents']) => {
  if (!value) {
    return ''
  }

  return value >= 1000 ? a.tokensK((value / 1000).toFixed(1)) : a.tokens(value)
}

const fmtAge = (updatedAt: number, nowMs: number, a: Translations['agents']) => {
  const s = Math.max(0, Math.round((nowMs - updatedAt) / 1000))

  if (s < 2) {
    return a.ageNow
  }

  if (s < 60) {
    return a.ageSeconds(s)
  }

  const m = Math.floor(s / 60)

  if (m < 60) {
    return a.ageMinutes(m)
  }

  return a.ageHours(Math.floor(m / 60))
}

const flatten = (nodes: readonly SubagentNode[]): SubagentNode[] =>
  nodes.flatMap(node => [node, ...flatten(node.children)])

interface RootGroup {
  id: string
  delegationIndex: number
  nodes: SubagentNode[]
  taskCount: number
}

function groupDelegations(roots: readonly SubagentNode[]): RootGroup[] {
  const groups: RootGroup[] = []
  let n = 0

  for (const node of roots) {
    const prev = groups.at(-1)
    const prevTail = prev?.nodes.at(-1)
    const closeInTime = prevTail ? Math.abs(node.startedAt - prevTail.startedAt) <= 5_000 : false
    const sameShape = prev && node.taskCount > 1 && prev.taskCount === node.taskCount
    const uniqueStep = prev ? !prev.nodes.some(item => item.taskIndex === node.taskIndex) : false

    if (prev && sameShape && closeInTime && uniqueStep) {
      prev.nodes.push(node)

      continue
    }

    if (node.taskCount > 1) {
      n += 1
      groups.push({ id: `delegation-${n}`, delegationIndex: n, nodes: [node], taskCount: node.taskCount })

      continue
    }

    groups.push({ id: node.id, delegationIndex: 0, nodes: [node], taskCount: node.taskCount })
  }

  return groups
}

function SubagentTree({ tree }: { tree: SubagentNode[] }) {
  const { t } = useI18n()
  const flat = useMemo(() => flatten(tree), [tree])
  const groups = useMemo(() => groupDelegations(tree), [tree])
  const [nowMs, setNowMs] = useState(() => Date.now())

  const active = flat.filter(n => n.status === 'running' || n.status === 'queued').length
  const failed = flat.filter(n => n.status === 'failed' || n.status === 'interrupted').length
  const tools = flat.reduce((sum, n) => sum + (n.toolCount ?? 0), 0)
  const files = flat.reduce((sum, n) => sum + n.filesRead.length + n.filesWritten.length, 0)
  const tokens = flat.reduce((sum, n) => sum + (n.inputTokens ?? 0) + (n.outputTokens ?? 0), 0)
  const cost = flat.reduce((sum, n) => sum + (n.costUsd ?? 0), 0)

  useEffect(() => {
    if (active <= 0 || typeof window === 'undefined') {
      return
    }

    const id = window.setInterval(() => setNowMs(Date.now()), 500)

    return () => window.clearInterval(id)
  }, [active])

  if (tree.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-12 text-center">
        <Codicon className="text-muted-foreground/60" name="hubot" size="1.5rem" />
        <p className="text-sm font-medium text-foreground/90">{t.agents.emptyTitle}</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground/75">{t.agents.emptyDesc}</p>
      </div>
    )
  }

  const summary = [
    t.agents.agentsCount(flat.length),
    active > 0 ? t.agents.activeCount(active) : '',
    failed > 0 ? t.agents.failedCount(failed) : '',
    tools > 0 ? t.agents.toolsCount(tools) : '',
    files > 0 ? t.agents.filesCount(files) : '',
    tokens > 0 ? fmtTokens(tokens, t.agents) : '',
    cost > 0 ? `$${cost.toFixed(2)}` : ''
  ].filter(Boolean)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <p className="shrink-0 text-[0.7rem] text-muted-foreground/70">{summary.join(' · ')}</p>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
        <div className="flex min-w-0 flex-col gap-6">
          {groups.map(group => (
            <DelegationGroup group={group} key={group.id} nowMs={nowMs} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DelegationGroup({ group, nowMs }: { group: RootGroup; nowMs: number }) {
  const { t } = useI18n()

  if (group.nodes.length === 1 && group.taskCount <= 1) {
    return <SubagentRow node={group.nodes[0]!} nowMs={nowMs} />
  }

  const activeWorkers = group.nodes.filter(n => n.status === 'running' || n.status === 'queued').length

  return (
    <section className="grid min-w-0 gap-3">
      <p className="text-[0.66rem] font-medium uppercase tracking-wider text-muted-foreground/70">
        {group.delegationIndex > 0 ? t.agents.delegation(group.delegationIndex) : ''}{' '}
        <span className="text-muted-foreground/50">·</span> {t.agents.workers(group.nodes.length)}
        {activeWorkers > 0 ? <span className="text-primary/85"> · {t.agents.workersActive(activeWorkers)}</span> : null}
      </p>
      <div className="grid min-w-0 gap-4">
        {group.nodes.map(node => (
          <SubagentRow key={node.id} node={node} nowMs={nowMs} />
        ))}
      </div>
    </section>
  )
}

function StreamLine({
  active,
  entry,
  parentRunning,
  rowKey
}: {
  active: boolean
  entry: SubagentStreamEntry
  parentRunning: boolean
  rowKey: string
}) {
  const { t } = useI18n()
  const enterRef = useEnterAnimation(parentRunning, `subagent-stream:${rowKey}`)
  const isMono = entry.kind === 'tool'
  const tone = entry.isError ? 'text-destructive' : STREAM_TONE[entry.kind]

  return (
    <div className="flex min-w-0 items-baseline gap-2 text-[0.72rem] leading-relaxed" ref={enterRef}>
      <span className="flex h-[0.95rem] shrink-0 items-center">{streamGlyph(entry)}</span>
      <span className={cn('min-w-0 flex-1 wrap-anywhere', tone, isMono && 'font-mono text-[0.69rem]')}>
        {entry.text}
        {active ? (
          <GlyphSpinner
            ariaLabel={t.agents.streaming}
            className="ml-1 inline-block size-2.5 align-middle text-muted-foreground/70"
            spinner="breathe"
          />
        ) : null}
      </span>
    </div>
  )
}

function CompletedRunRow({ onOpen, run }: { onOpen: (run: StudioAgentRun) => void; run: StudioAgentRun }) {
  const title = run.profile_name || run.profile_id || run.title || 'Agent Run'
  const subtitle = [run.profile_id, run.model, run.message_count ? `${run.message_count} messages` : '', run.id].filter(Boolean)

  return (
    <button
      className="group grid min-w-0 gap-1 rounded-xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-border hover:bg-muted/35"
      onClick={() => onOpen(run)}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-emerald-600/85 dark:text-emerald-400/85" />
        <span className="truncate text-[0.82rem] font-medium text-foreground/90 group-hover:text-foreground">{title}</span>
      </span>
      {subtitle.length > 0 ? <span className="truncate text-[0.66rem] text-muted-foreground/65">{subtitle.join(' · ')}</span> : null}
      {run.summary ? <span className="line-clamp-2 text-[0.72rem] leading-relaxed text-muted-foreground/75">{run.summary}</span> : null}
    </button>
  )
}

function CompletedNodeRow({
  node,
  nowMs,
  onOpen
}: {
  node: SubagentNode
  nowMs: number
  onOpen: (run: StudioAgentRun) => void
}) {
  const { t } = useI18n()
  const run: StudioAgentRun = {
    id: node.sessionId || node.id,
    model: node.model,
    profile_id: node.profileId,
    profile_name: node.profileName,
    summary: node.summary || node.stream.at(-1)?.text || node.goal,
    updated_at: node.updatedAt,
    message_count: node.stream.length
  }
  const subtitle = [
    node.profileId,
    node.model,
    fmtDuration(node.durationSeconds, t.agents),
    node.sessionId,
    t.agents.updatedAgo(fmtAge(node.updatedAt, nowMs, t.agents))
  ].filter(Boolean)

  return (
    <button
      className="group grid min-w-0 gap-1 rounded-xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-border hover:bg-muted/35"
      disabled={!node.sessionId}
      onClick={() => node.sessionId && onOpen(run)}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        {statusGlyph(node.status, t.agents)}
        <span className="truncate text-[0.82rem] font-medium text-foreground/90 group-hover:text-foreground">
          {node.profileName || node.profileId || node.goal}
        </span>
      </span>
      {subtitle.length > 0 ? <span className="truncate text-[0.66rem] text-muted-foreground/65">{subtitle.join(' · ')}</span> : null}
      <span className="line-clamp-2 text-[0.72rem] leading-relaxed text-muted-foreground/75">
        {node.summary || node.stream.at(-1)?.text || node.goal}
      </span>
    </button>
  )
}

function SubagentRow({ node, depth = 0, nowMs }: { node: SubagentNode; depth?: number; nowMs: number }) {
  const { t } = useI18n()
  const running = node.status === 'running' || node.status === 'queued'
  const elapsed = useElapsedSeconds(running, `subagent:${node.id}`)

  const durationSeconds =
    typeof node.durationSeconds === 'number' ? Math.max(0, Math.round(node.durationSeconds)) : elapsed

  const [open, setOpen] = useState(() => running || depth < 2)
  const enterRef = useEnterAnimation(true, `subagent-row:${node.id}`)

  useEffect(() => {
    if (running) {
      setOpen(true)
    }
  }, [running])

  const visibleRows = open ? node.stream.slice(-10) : node.stream.slice(-2)
  const fileLines = [...node.filesWritten.map(p => `+ ${p}`), ...node.filesRead.map(p => `· ${p}`)]

  const subtitle = [
    node.profileName || node.profileId,
    node.model,
    fmtDuration(durationSeconds, t.agents),
    node.toolCount ? t.agents.toolsCount(node.toolCount) : '',
    fmtTokens((node.inputTokens ?? 0) + (node.outputTokens ?? 0), t.agents),
    t.agents.updatedAgo(fmtAge(node.updatedAt, nowMs, t.agents))
  ].filter(Boolean)

  return (
    <div className={cn('grid min-w-0 max-w-full gap-2', depth > 0 && 'pl-4')} data-slot="tool-block" ref={enterRef}>
      <button
        aria-expanded={open}
        className="group flex w-full min-w-0 items-start gap-2.5 text-left"
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <span className="mt-0.5 flex h-[1.1rem] shrink-0 items-center">{statusGlyph(node.status, t.agents)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'wrap-anywhere text-[0.82rem] font-medium leading-[1.1rem] text-foreground/90 transition-colors group-hover:text-foreground',
              running && 'shimmer text-foreground/65'
            )}
          >
            {node.goal}
          </span>
          {subtitle.length > 0 ? (
            <FadeText className="text-[0.66rem] leading-[1.05rem] text-muted-foreground/65">
              {subtitle.join(' · ')}
            </FadeText>
          ) : null}
        </span>
        {running ? <ActivityTimerText className="mt-1 shrink-0 text-[0.6rem]" seconds={durationSeconds} /> : null}
      </button>

      {visibleRows.length > 0 ? (
        <div className="grid min-w-0 gap-1 pl-6" data-selectable-text="true">
          {visibleRows.map((entry, i) => (
            <StreamLine
              active={running && i === visibleRows.length - 1}
              entry={entry}
              key={`${entry.kind}:${entry.at}:${i}`}
              parentRunning={running}
              rowKey={`${node.id}:${entry.kind}:${entry.at}`}
            />
          ))}
        </div>
      ) : null}

      {open && fileLines.length > 0 ? (
        <div className="grid min-w-0 gap-0.5 pl-6" data-selectable-text="true">
          <p className="text-[0.58rem] font-medium tracking-wider text-muted-foreground/60 uppercase">
            {t.agents.files}
          </p>
          {fileLines.slice(0, 8).map(line => (
            <p className="wrap-break-word font-mono text-[0.67rem] leading-relaxed text-muted-foreground/80" key={line}>
              {line}
            </p>
          ))}
          {fileLines.length > 8 ? (
            <p className="font-mono text-[0.67rem] leading-relaxed text-muted-foreground/65">
              {t.agents.moreFiles(fileLines.length - 8)}
            </p>
          ) : null}
        </div>
      ) : null}

      {node.children.length > 0 ? (
        <div className="grid min-w-0 gap-3 pl-6">
          {node.children.map(child => (
            <SubagentRow depth={depth + 1} key={child.id} node={child} nowMs={nowMs} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

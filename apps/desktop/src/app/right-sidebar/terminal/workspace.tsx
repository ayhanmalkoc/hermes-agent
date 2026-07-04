import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import type { HermesConnection } from '@/global'
import type { HermesGateway } from '@/hermes'
import { $backgroundStatusBySession } from '@/store/composer-status'
import { pruneRightWorkspaceTerminalTabs } from '@/store/right-workspace'
import { $activeSessionId } from '@/store/session'

import { seedAgentTerminalCommand, syncAgentTerminalSnapshot } from './agent-terminal-stream'
import { setActiveTerminalId } from './buffer'
import { AgentTerminalInstance, TerminalInstance } from './instance'
import { $activeTerminalId, $terminals, closeFinishedAgentTerminals, ensureAgentTerminal } from './terminals'

interface TerminalWorkspaceProps {
  connection?: HermesConnection | null
  gateway?: HermesGateway | null
  onAddSelectionToChat: (text: string, label?: string) => void
}

/** The persistent-overlay layer: the stack of live xterm instances (only these
 *  must stay in the fixed overlay, for the WebGL host). Mount/visibility is owned
 *  by PersistentTerminal (latched so shells survive hiding); terminal tabs live
 *  in the right-workspace header. */
export function TerminalWorkspace({ connection, gateway, onAddSelectionToChat }: TerminalWorkspaceProps) {
  const terminals = useStore($terminals)
  const activeId = useStore($activeTerminalId)
  const background = useStore($backgroundStatusBySession)
  const activeSessionId = useStore($activeSessionId)

  // Mirror the tab selection into the agent reader (read_terminal reads it).
  useEffect(() => {
    const unsubscribe = $activeTerminalId.subscribe(setActiveTerminalId)

    return () => {
      unsubscribe()
      setActiveTerminalId(null)
    }
  }, [])

  // Surface the agent's background processes as read-only tabs (once each).
  // Live chunks stream via agent.terminal.output; the process-list snapshot also
  // seeds/falls back so the tab never stays blank if the stream races startup.
  useEffect(() => {
    const list = activeSessionId ? (background[activeSessionId] ?? []) : []
    const finishedIds = list.filter(item => item.state !== 'running').map(item => item.id)

    closeFinishedAgentTerminals(finishedIds)

    for (const item of list) {
      if (item.state !== 'running') {
        continue
      }

      ensureAgentTerminal(item.id, item.title)
      seedAgentTerminalCommand(item.id, item.title)
      syncAgentTerminalSnapshot(item.id, item.output ?? '')
    }
  }, [activeSessionId, background])

  useEffect(() => {
    pruneRightWorkspaceTerminalTabs(terminals.map(term => term.id))
  }, [terminals])

  return (
    <>
      {terminals.map(term =>
        term.kind === 'agent' ? (
          <AgentTerminalInstance active={term.id === activeId} id={term.id} key={term.id} procId={term.procId!} />
        ) : (
          <TerminalInstance
            active={term.id === activeId}
            connection={connection}
            cwd={term.cwd}
            gateway={gateway}
            id={term.id}
            key={term.id}
            onAddSelectionToChat={onAddSelectionToChat}
            reviveBuffer={term.reviveBuffer}
          />
        )
      )}
    </>
  )
}

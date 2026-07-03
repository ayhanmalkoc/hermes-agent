import { useEffect } from 'react'

import type { RightWorkspaceTab } from '@/store/right-workspace'

import { TerminalPaneChrome } from '../../right-sidebar/terminal/chrome'
import { selectTerminal } from '../../right-sidebar/terminal/terminals'

interface TerminalWorkspaceTabProps {
  tab: RightWorkspaceTab
}

export function TerminalWorkspaceTab({ tab }: TerminalWorkspaceTabProps) {
  useEffect(() => {
    if (tab.terminalId) {
      selectTerminal(tab.terminalId)
    }
  }, [tab.terminalId])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-(--ui-editor-surface-background)">
      <TerminalPaneChrome />
    </div>
  )
}

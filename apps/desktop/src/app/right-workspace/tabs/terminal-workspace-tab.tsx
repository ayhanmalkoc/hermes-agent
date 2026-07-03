import { TerminalPaneChrome } from '../../right-sidebar/terminal/chrome'

export function TerminalWorkspaceTab() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-(--ui-editor-surface-background)">
      <TerminalPaneChrome />
    </div>
  )
}

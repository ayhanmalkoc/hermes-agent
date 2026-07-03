import { TerminalSlot } from './persistent'

/** Pane-side terminal chrome: the body slot chased by the persistent overlay.
 *  Terminal tabs live in the right-workspace header. */
export function TerminalPaneChrome() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <TerminalSlot />
      </div>
    </div>
  )
}

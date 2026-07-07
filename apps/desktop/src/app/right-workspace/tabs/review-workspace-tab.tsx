import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { $reviewFiles, $reviewShipInfo, refreshReview, selectReviewFile } from '@/store/review'
import { toggleRightWorkspaceTabTree, type RightWorkspaceTab } from '@/store/right-workspace'

import { ReviewPane } from '../../right-sidebar/review'

export function ReviewWorkspaceTab({ tab }: { tab: RightWorkspaceTab }) {
  const files = useStore($reviewFiles)
  const shipInfo = useStore($reviewShipInfo)
  const added = files.reduce((sum, file) => sum + file.added, 0)
  const removed = files.reduce((sum, file) => sum + file.removed, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-(--ui-stroke-quaternary) px-3 text-xs">
        <button className="rounded-lg bg-(--ui-hover-background) px-2 py-1 text-(--ui-text-secondary)" type="button">
          Unstaged <span className="ml-1 rounded bg-(--ui-surface-muted) px-1">0</span>
        </button>
        <span className="text-emerald-500">+{added}</span>
        <span className="text-red-500">-{removed}</span>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Review settings" size="icon-xs" variant="ghost">
              <Codicon name="ellipsis" size="0.9rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={() => void refreshReview()}>
              <Codicon className="mr-2" name="refresh" size="0.875rem" />
              Refresh
            </DropdownMenuItem>
            <DropdownMenuItem>Disable word wrap</DropdownMenuItem>
            <DropdownMenuItem>Load full files</DropdownMenuItem>
            <DropdownMenuItem>Enable rich preview</DropdownMenuItem>
            <DropdownMenuItem>Enable word diffs</DropdownMenuItem>
            <DropdownMenuItem>Hide whitespace</DropdownMenuItem>
            <DropdownMenuItem>Copy git apply command</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label="Collapse/expand all diffs">
          <Button aria-label="Collapse/expand all diffs" size="icon-xs" variant="ghost">
            <Codicon name="collapse-all" size="0.9rem" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Go to file" size="icon-xs" variant="ghost">
              <Codicon name="go-to-file" size="0.9rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-auto">
            {files.map(file => (
              <DropdownMenuItem key={file.path} onClick={() => void selectReviewFile(file)}>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem]">{file.path}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label="Unified/split diff view">
          <Button aria-label="Unified/split diff view" size="icon-xs" variant="ghost">
            <Codicon name="split-horizontal" size="0.9rem" />
          </Button>
        </Tip>
        <Tip label={tab.treeVisible ? 'Hide files' : 'Show files'}>
          <Button aria-label={tab.treeVisible ? 'Hide files' : 'Show files'} onClick={() => toggleRightWorkspaceTabTree(tab.id)} size="icon-xs" variant="ghost">
            <Codicon name="files" size="0.9rem" />
          </Button>
        </Tip>
        <Button size="xs" variant="secondary">
          Commit
        </Button>
        <Tip label="Install GitHub CLI to create a PR">
          <span>
            <Button disabled size="icon-xs" variant="ghost">
              <Codicon name="github" size="0.9rem" />
            </Button>
          </span>
        </Tip>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ReviewPane />
      </div>
    </div>
  )
}

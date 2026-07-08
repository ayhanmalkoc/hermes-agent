import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import { SidebarPanelLabel } from '../../shell/sidebar-label'

export function RightWorkspaceSectionHeader({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('group/project-header flex h-7 shrink-0 items-center px-2.5', className)} {...props}>
      {children}
    </div>
  )
}

export function PaneEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4">
      <SidebarPanelLabel className="pl-0 text-(--ui-text-quaternary)">{label}</SidebarPanelLabel>
    </div>
  )
}

export function EmptyState({ body, title }: { body: string; title?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
      {title && (
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">{title}</div>
      )}
      <div className="text-[0.68rem] leading-relaxed text-muted-foreground/65">{body}</div>
    </div>
  )
}

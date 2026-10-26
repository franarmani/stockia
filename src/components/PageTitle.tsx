import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageTitleProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
  /** Breadcrumb label (e.g. "Menú / Productos") — rendered as small text above title */
  breadcrumb?: string
}

/**
 * Consistent page header used inside every GlassPanel content area.
 * Renders title + optional subtitle on the left, actions on the right.
 */
export default function PageTitle({ title, subtitle, actions, className, breadcrumb }: PageTitleProps) {
  return (
    <div className={cn('flex flex-col min-[760px]:flex-row min-[760px]:items-end min-[760px]:justify-between gap-4 mb-5 sm:mb-7 min-w-0', className)}>
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-[11px] text-[#9aa9ff] font-semibold mb-1 tracking-[0.02em]">{breadcrumb}</p>
        )}
        <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">{title}</h1>
        {subtitle && <p className="text-[13px] text-white/55 mt-1 max-w-2xl text-pretty">{subtitle}</p>}
      </div>
      {actions && (
        <div className="page-title-actions grid grid-cols-2 sm:flex items-center gap-2 w-full min-[760px]:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}

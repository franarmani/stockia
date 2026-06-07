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
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6', className)}>
      <div>
        {breadcrumb && (
          <p className="text-[11px] text-white/35 font-medium mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-white/55 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}

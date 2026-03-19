import { cn } from '@/lib/utils'
import type { StockStatus } from '@/types/database'

interface StockBadgeProps {
  status: StockStatus
  stock: number
  stockMin: number
  unit?: string
  daysLeft?: number | null
  className?: string
  showDays?: boolean
}

const STYLES: Record<StockStatus, string> = {
  ok:       'bg-green-500/15 text-green-400 border-green-500/25',
  low:      'bg-amber-500/15 text-amber-400 border-amber-500/25',
  critical: 'bg-red-500/15  text-red-400  border-red-500/25',
}

const LABELS: Record<StockStatus, string> = {
  ok:       'OK',
  low:      'Bajo',
  critical: 'Crítico',
}

export function StockBadge({ status, stock, unit = 'u', className, showDays = false, daysLeft }: StockBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold',
      STYLES[status],
      className
    )}>
      {LABELS[status]}
      <span className="opacity-70 font-normal">
        {stock} {unit}
        {showDays && daysLeft != null && daysLeft > 0 && (
          <> · ~{Math.round(daysLeft)}d</>
        )}
      </span>
    </span>
  )
}

export function StockDot({ status }: { status: StockStatus }) {
  const dot: Record<StockStatus, string> = {
    ok: 'bg-green-400',
    low: 'bg-amber-400',
    critical: 'bg-red-500 animate-pulse',
  }
  return <span className={cn('inline-block w-2 h-2 rounded-full', dot[status])} />
}

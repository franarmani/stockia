import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: { value: number; positive: boolean }
  tone?: 'primary' | 'secondary'
  className?: string
  onClick?: () => void
}

export default function StatCard({ title, value, icon: Icon, description, trend, tone = 'primary', className, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn('bg-surface rounded-2xl p-4 border border-border shadow-sm', onClick && 'cursor-pointer', className)}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tone === 'secondary' ? 'bg-secondary/10' : 'bg-primary/10')}>
          <Icon className={cn('w-5 h-5', tone === 'secondary' ? 'text-secondary' : 'text-primary')} />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground font-mono tabular-nums">{value}</p>
      {(description || trend) && (
        <div className="mt-1 flex items-center gap-1.5">
          {trend && (
            <span className={cn('text-[11px] font-semibold font-mono', trend.positive ? 'text-primary' : 'text-destructive')}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
          )}
          {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
        </div>
      )}
    </div>
  )
}

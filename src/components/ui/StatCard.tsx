import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: { value: number; positive: boolean }
  className?: string
}

export default function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-2xl p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {(description || trend) && (
        <div className="mt-1 flex items-center gap-1.5">
          {trend && (
            <span className={cn('text-[11px] font-semibold', trend.positive ? 'text-primary' : 'text-red-600')}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
          )}
          {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
        </div>
      )}
    </div>
  )
}

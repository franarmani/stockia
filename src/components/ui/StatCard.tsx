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
      className={cn('cg-card p-5 transition-all duration-200', onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/30', className)}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted-foreground tracking-[0.02em]">{title}</p>
        <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center border', tone === 'secondary' ? 'bg-secondary/10 border-secondary/15' : 'bg-[#9aa9ff]/10 border-[#9aa9ff]/20')}>
          <Icon className={cn('w-5 h-5', tone === 'secondary' ? 'text-secondary' : 'text-[#9aa9ff]')} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-[-0.035em] text-foreground font-mono tabular-nums">{value}</p>
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

import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline'
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none gap-1',
        {
          'bg-primary/15 text-primary': variant === 'default' || variant === 'success',
          'bg-amber-500/15 text-amber-400': variant === 'warning',
          'bg-destructive/15 text-destructive': variant === 'destructive',
          'border border-white/10 text-slate-400': variant === 'outline',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

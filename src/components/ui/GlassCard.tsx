import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/* ─────────────────────────────────────────────────────
   GlassCard  — subtle glass for tiles/kpi cards
───────────────────────────────────────────────────── */
interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  glow?: boolean
}

export function GlassCard({ children, className, onClick, glow }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card',
        glow && 'glass-card--glow',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   GlassPanel  — larger panel for page content areas
───────────────────────────────────────────────────── */
interface GlassPanelProps {
  children: ReactNode
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div className={cn('glass-panel', className)}>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   GlassButton  — ghost-glass button
───────────────────────────────────────────────────── */
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function GlassButton({ children, className, size = 'md', ...props }: GlassButtonProps) {
  return (
    <button
      className={cn(
        'glass-btn inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        {
          'h-7 px-3 text-xs rounded-lg': size === 'sm',
          'h-9 px-4 text-sm rounded-xl': size === 'md',
          'h-11 px-5 text-[15px] rounded-xl': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

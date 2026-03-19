import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ModuleTileProps {
  name: string
  href: string
  icon: LucideIcon
  description?: string
  badge?: number | string
  shortcut?: string
  color?: string   // icon background tint e.g. "bg-green-500/20"
  iconColor?: string
  delay?: number
}

export default function ModuleTile({
  name,
  href,
  icon: Icon,
  description,
  badge,
  shortcut,
  color = 'bg-white/10',
  iconColor = 'text-white',
  delay = 0,
}: ModuleTileProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(href)}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'module-tile group relative flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-xl',
        'bg-white/5 border border-white/10 backdrop-blur-sm',
        'hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl',
        'active:scale-95 transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        'animate-fade-in-up text-left cursor-pointer w-full'
      )}
    >
      {/* Keyboard shortcut badge — always visible */}
      {shortcut && (
        <kbd className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-4.5 h-4.5 rounded-md bg-white/10 border border-white/15 text-[9px] font-bold text-white/50 font-mono group-hover:bg-white/20 group-hover:border-white/25 group-hover:text-white/90 transition-all pointer-events-none">
          {shortcut.toUpperCase()}
        </kbd>
      )}

      {/* Icon circle */}
      <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-lg', color)}>
        <Icon className={cn('w-5 h-5 sm:w-5.5 sm:h-5.5', iconColor)} />
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-[11px] sm:text-[12px] font-semibold text-white leading-tight">{name}</p>
        {description && (
          <p className="text-[9px] sm:text-[10px] text-white/40 mt-0.5 leading-tight">{description}</p>
        )}
      </div>

      {/* Badge */}
      {badge !== undefined && badge !== 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center shadow-sm">
          {badge}
        </span>
      )}
    </button>
  )
}

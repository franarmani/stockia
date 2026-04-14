import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface BentoCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  href?: string
  onClick?: () => void
  colSpan?: string // Tailwind classes e.g. "col-span-2"
  rowSpan?: string // Tailwind classes e.g. "row-span-2"
  iconBackground?: string
  iconColor?: string
  children?: ReactNode
  className?: string
  badge?: string | number
}

export default function BentoCard({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  colSpan = 'col-span-1',
  rowSpan = 'row-span-1',
  iconBackground = 'bg-white/5',
  iconColor = 'text-white/40',
  children,
  className,
  badge
}: BentoCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) onClick()
    else if (href) navigate(href)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative overflow-hidden rounded-xl transition-all duration-300',
        'bg-slate-900/60 border border-white/10 backdrop-blur-xl',
        'hover:bg-slate-800/80 hover:border-white/20 hover:shadow-2xl hover:shadow-black/40',
        'active:scale-[0.98] cursor-pointer',
        colSpan,
        rowSpan,
        className
      )}
    >
      {/* Subtle Gradient Glow */}
      <div className="absolute -inset-px bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Content Container */}
      <div className="relative z-10 p-3.5 h-full flex flex-col">
        {/* Top Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                "group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                iconBackground
              )}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors tracking-tight">
                {title}
              </h3>
              {description && (
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {badge !== undefined && badge !== 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-tighter">
              {badge}
            </span>
          )}
        </div>

        {/* Custom Content Area */}
        <div className="flex-1">
          {children}
        </div>
      </div>

      {/* Subtle Hover Glow */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  )
}

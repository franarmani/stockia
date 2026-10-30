import React from 'react'

interface BrandProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTag?: string
  className?: string
  iconOnly?: boolean
  useFullLogo?: boolean
}

export function CajaGoIcon({ size = 'md', className = '' }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  }

  return (
    <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <img
        src="/iconocajago.png"
        alt="CajaGo"
        className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(62,115,245,0.4)]"
      />
    </div>
  )
}

export function CajaGoWordmark({ size = 'md', className = '' }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const fontSizes = {
    xs: 'text-sm tracking-tight',
    sm: 'text-base tracking-tight',
    md: 'text-xl tracking-tight',
    lg: 'text-2xl tracking-tighter',
    xl: 'text-3xl sm:text-4xl tracking-tighter',
  }

  return (
    <span className={`font-sans font-extrabold select-none ${fontSizes[size]} ${className}`}>
      <span className="text-slate-900 dark:text-[#FCFCFD] transition-colors">Caja</span>
      <span className="text-[#6178ee] font-black ml-0.5">
        Go
      </span>
    </span>
  )
}

export default function CajaGoBrand({
  size = 'md',
  showTag,
  className = '',
  iconOnly = false,
  useFullLogo = true,
}: BrandProps) {
  if (iconOnly) {
    return <CajaGoIcon size={size} className={className} />
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <CajaGoIcon size={size} />
      <div className="flex items-center gap-1.5 leading-none">
        <CajaGoWordmark size={size} />
        {showTag && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold uppercase tracking-wider">
            {showTag}
          </span>
        )}
      </div>
    </div>
  )
}

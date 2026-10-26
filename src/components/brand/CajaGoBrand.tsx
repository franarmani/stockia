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
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
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
    <span className={`font-sans font-black select-none ${fontSizes[size]} ${className}`}>
      <span className="text-[#FCFCFD]">Caja</span>
      <span className="bg-gradient-to-r from-[#3E73F5] via-[#947FF8] to-[#DE9BD3] bg-clip-text text-transparent">
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

  if (useFullLogo) {
    const fullHeights = {
      xs: 'h-6',
      sm: 'h-7',
      md: 'h-9',
      lg: 'h-12',
      xl: 'h-16',
    }
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <img
          src="/logocajago.png"
          alt="CajaGo"
          className={`${fullHeights[size]} w-auto object-contain select-none filter drop-shadow-[0_4px_20px_rgba(62,115,245,0.25)]`}
        />
        {showTag && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#947FF8]/15 text-[#947FF8] border border-[#947FF8]/30 font-bold uppercase tracking-wider">
            {showTag}
          </span>
        )}
      </div>
    )
  }


  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <CajaGoIcon size={size} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <CajaGoWordmark size={size} />
          {showTag && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#947FF8]/15 text-[#947FF8] border border-[#947FF8]/30 font-bold uppercase tracking-wider">
              {showTag}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-[0.8rem] transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px',
          {
            'bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent': variant === 'default' || variant === 'accent',
            'bg-white/[0.045] text-text-secondary hover:bg-white/[0.075] border border-white/10 hover:border-white/20': variant === 'secondary',
            'border border-white/12 bg-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white hover:border-white/25': variant === 'outline',
            'text-slate-400 hover:text-white hover:bg-white/[0.045]': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent': variant === 'destructive',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-11 px-5 text-sm': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
export default Button

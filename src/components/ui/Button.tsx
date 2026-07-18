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
          'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          {
            'bg-primary/90 text-primary-foreground hover:bg-primary shadow-[0_0_12px_rgba(0,240,255,0.3)] hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] border border-primary/50 hover:border-primary': variant === 'default' || variant === 'accent',
            'bg-white/5 text-text-secondary hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20': variant === 'secondary',
            'border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-primary hover:border-primary/40': variant === 'outline',
            'text-slate-400 hover:text-white hover:bg-white/5': variant === 'ghost',
            'bg-destructive/90 text-destructive-foreground hover:bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.3)] border border-destructive/50': variant === 'destructive',
          },
          {
            'h-7 px-2.5 text-xs': size === 'sm',
            'h-9 px-3.5 text-sm': size === 'md',
            'h-11 px-5 text-sm': size === 'lg',
            'h-9 w-9': size === 'icon',
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

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
          'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          {
            'gradient-primary text-white hover:brightness-110 shadow-sm shadow-green-900/10': variant === 'default' || variant === 'accent',
            'bg-slate-100 text-slate-700 hover:bg-slate-200': variant === 'secondary',
            'border border-slate-200 bg-white text-foreground hover:bg-slate-50': variant === 'outline',
            'text-foreground hover:bg-slate-100': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
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

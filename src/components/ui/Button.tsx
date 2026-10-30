import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px select-none shrink-0',
          {
            // Default & Accent: Solid brand action with defined border
            'bg-primary text-primary-foreground hover:bg-primary-hover border border-primary/40 dark:border-primary/50 shadow-xs': variant === 'default' || variant === 'accent',
            // Secondary: Surface with clear border in both light and dark
            'bg-surface-secondary text-foreground hover:bg-surface-elevated border border-border hover:border-border-subtle shadow-xs': variant === 'secondary',
            // Outline: Crisp transparent with border and hover elevation
            'border border-border hover:border-primary/50 bg-transparent text-foreground hover:bg-surface-secondary hover:text-primary shadow-xs': variant === 'outline',
            // Ghost: Subtle ghost button with border on hover
            'text-muted-foreground hover:text-foreground hover:bg-surface-secondary border border-transparent hover:border-border': variant === 'ghost',
            // Destructive: Danger red with distinct border
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-destructive/40 shadow-xs': variant === 'destructive',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-11 px-5 text-sm': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
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

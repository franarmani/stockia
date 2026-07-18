import { cn } from '@/lib/utils'
import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-2 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:shadow-[0_0_12px_rgba(0,240,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/20 hover:bg-white/10',
            error && 'border-destructive focus:ring-destructive',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select

import { cn } from '@/lib/utils'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="w-full overflow-auto rounded-[14px] bg-surface border border-border shadow-[0_14px_38px_rgba(2,5,10,0.16)]">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({ children, className }: TableProps) {
  return <thead className={cn('bg-white/[0.025]', className)}>{children}</thead>
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn('divide-y divide-border', className)}>{children}</tbody>
}

export function TableRow({ children, className, onClick }: TableProps & { onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'hover:bg-muted/30 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  )
}

export function TableHead({ children, className }: TableProps) {
  return (
    <th className={cn('px-4 py-3.5 text-left text-[11px] font-semibold text-muted-foreground tracking-[0.025em]', className)}>
      {children}
    </th>
  )
}

export function TableCell({ children, className }: TableProps) {
  return <td className={cn('px-4 py-3 text-foreground', className)}>{children}</td>
}

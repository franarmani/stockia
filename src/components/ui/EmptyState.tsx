interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-0.5">{title}</h3>
      <p className="text-[13px] text-muted-foreground mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}

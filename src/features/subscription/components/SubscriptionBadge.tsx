import { useNavigate } from 'react-router-dom'
import { useSubscription } from '..'
import { cn } from '@/lib/utils'

interface SubscriptionBadgeProps {
  className?: string
}

export default function SubscriptionBadge({ className }: SubscriptionBadgeProps) {
  const { planName, daysRemaining, isExpired, isLoading, daysSinceExpired, status } = useSubscription()
  const navigate = useNavigate()

  if (isLoading) {
    return <div className={cn('h-5 w-28 bg-white/5 rounded animate-pulse', className)} />
  }

  const variant = isExpired
    ? 'text-red-400 border-red-500/20 bg-red-500/10'
    : daysRemaining <= 7 && status !== 'active'
    ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
    : 'text-green-400 border-green-500/20 bg-green-500/10'

  let label = '';
  if (status === 'active') {
    label = 'Plan Negocio · Activo';
  } else if (isExpired) {
    label = daysSinceExpired > 0
      ? 'Vencido hace ' + daysSinceExpired + ' día' + (daysSinceExpired !== 1 ? 's' : '')
      : 'Vencido hoy';
  } else {
    label = planName + ' · ' + daysRemaining + ' día' + (daysRemaining !== 1 ? 's' : '');
  }

  return (
    <button
      onClick={() => navigate('/settings')}
      className={cn(
        'text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors truncate max-w-full',
        variant,
        className
      )}
    >
      {label}
    </button>
  )
}

import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Info, X } from 'lucide-react'
import { useSubscription } from '..'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export default function SubscriptionBanner() {
  const { bannerState, isLoading, expiresToday, isExpired, status } = useSubscription()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  // Hide banner if trial_ends_at is in the past, even if status says "active"
  const isTrialEndedPast = bannerState?.endDate ? 
    bannerState.endDate.getTime() < new Date().getTime() : false

  if (isLoading || !bannerState || dismissed || expiresToday || isExpired || status === 'expired' || isTrialEndedPast) return null

  const styles: Record<string, string> = {
    expired: 'bg-red-500/10 border-red-500/20',
    expires_today: 'bg-amber-500/10 border-amber-500/20',
    urgent: 'bg-amber-500/10 border-amber-500/20',
    soon: 'bg-blue-500/10 border-blue-500/20',
  }

  const icons: Record<string, React.ReactNode> = {
    expired: <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />,
    expires_today: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    urgent: <Clock className="w-5 h-5 text-amber-400 shrink-0" />,
    soon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  }

  const textColors: Record<string, string> = {
    expired: 'text-red-300',
    expires_today: 'text-amber-300',
    urgent: 'text-amber-300',
    soon: 'text-blue-300',
  }

  const btnStyles: Record<string, string> = {
    expired: 'bg-red-500/20 text-red-300 hover:bg-red-500/30',
    expires_today: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30',
    urgent: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30',
    soon: 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30',
  }

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 border rounded-xl', styles[bannerState.variant])}>
      {icons[bannerState.variant]}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', textColors[bannerState.variant])}>{bannerState.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {bannerState.variant === 'expired' && (
          <button
            onClick={() => navigate('/settings')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            Informar pago
          </button>
        )}
        <button
          onClick={() => navigate(bannerState.actionPath)}
          className={cn('text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap', btnStyles[bannerState.variant])}
        >
          {bannerState.actionLabel}
        </button>
        {bannerState.variant !== 'expired' && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
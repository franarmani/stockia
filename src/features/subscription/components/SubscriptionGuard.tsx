import { useSubscription } from '../hooks/useSubscription'
import { AlertTriangle, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SubscriptionGuardProps {
  children: React.ReactNode
  mode?: 'warning' | 'block'
}

export default function SubscriptionGuard({ children, mode = 'warning' }: SubscriptionGuardProps) {
  const { isExpired, isLoading, status } = useSubscription()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (mode === 'block' && (isExpired || status === 'expired')) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Suscripción vencida</h2>
        <p className="text-sm text-white/50 mb-6">
          Tu Plan Negocio se encuentra vencido. Regularizá el pago para seguir operando.
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="px-6 h-11 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-110 transition-all"
        >
          Ver suscripción
        </button>
      </div>
    )
  }

  return <>{children}</>
}
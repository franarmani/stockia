import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, ArrowRight, X, Sparkles, AlertCircle } from 'lucide-react'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

export default function MercadoPagoPromptBanner({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { business } = useBusinessStore()
  const { profile } = useAuthStore()

  const [dismissed, setDismissed] = useState(() => {
    if (!business?.id) return false
    try {
      return sessionStorage.getItem(`cajago_dismiss_mp_prompt_${business.id}`) === '1'
    } catch {
      return false
    }
  })

  // Solo se muestra a administradores de negocios que todavía no tienen débito automático activo
  if (!business || business.mp_subscription_status === 'authorized') return null
  if (profile && profile.role !== 'admin') return null
  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    try {
      if (business?.id) {
        sessionStorage.setItem(`cajago_dismiss_mp_prompt_${business.id}`, '1')
      }
    } catch {}
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/40 via-[#0B1528] to-indigo-950/30 p-4 sm:p-5 shadow-lg backdrop-blur-md transition-all',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400/20 to-blue-600/30 border border-sky-400/30 flex items-center justify-center shrink-0 text-sky-400 shadow-inner">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/25">
                Suscripción Mensual
              </span>
              <span className="text-[11px] font-medium text-white/40">· Débito automático</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Recordá suscribirte a la mensualidad
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Conectá tu cuenta de Mercado Pago para que el cobro de tu abono se realice automáticamente cada mes y tu negocio funcione siempre sin interrupciones.
            </p>
            {business.pending_discount_note && (
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{business.pending_discount_note}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={() => navigate('/settings?tab=subscription')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-sky-950/50 transition-all active:scale-[0.98]"
          >
            <span>Suscribirme con Mercado Pago</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            title="Ocultar por esta sesión"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-sky-500/10 blur-3xl" />
    </div>
  )
}


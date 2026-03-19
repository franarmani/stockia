import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { Zap, AlertTriangle, ArrowRight, Clock, Copy, MessageCircle } from 'lucide-react'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

const ALIAS = 'farmani2.ppay'
const WA_NUMBER = '5492915716099'
const PRECIO = '$50.000'

export default function SubscriptionBlockedPage() {
  const { business } = useBusinessStore()
  const { user } = useAuthStore()

  const isTrialExpired =
    business?.subscription_status === 'trial' &&
    !!business?.trial_ends_at &&
    new Date(business.trial_ends_at) < new Date()

  function copyAlias() {
    navigator.clipboard.writeText(ALIAS)
    toast.success('Alias copiado: ' + ALIAS)
  }

  function sendWA() {
    const msg = `Hola Fran! Acabo de hacer la transferencia de ${PRECIO} al alias ${ALIAS} para activar mi cuenta en STOCKIA. Mi email es: ${user?.email ?? ''} — ${business?.name ?? ''}. Quedo a la espera, gracias!`
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className={`w-12 h-12 ${isTrialExpired ? 'bg-blue-50' : 'bg-amber-50'} rounded-xl flex items-center justify-center mx-auto mb-4`}>
          {isTrialExpired
            ? <Clock className="w-6 h-6 text-blue-600" />
            : <AlertTriangle className="w-6 h-6 text-amber-600" />
          }
        </div>
        <h1 className="text-lg font-bold text-foreground mb-1.5">
          {isTrialExpired ? 'Tu período de prueba terminó' : 'Suscripción vencida'}
        </h1>
        <p className="text-[13px] text-muted-foreground mb-6">
          {isTrialExpired
            ? 'Los 7 días gratuitos llegaron a su fin. Suscribite para seguir usando STOCKIA y no perder tu historial de ventas y datos.'
            : 'Tu suscripción ha vencido. Para seguir usando STOCKIA y registrar nuevas ventas, necesitás renovar tu plan.'
          }
        </p>

        {/* Instrucciones de pago */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 mb-4 text-left">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Cómo activar tu cuenta</p>

          <div className="space-y-3">
            {/* Paso 1 */}
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-[13px] font-semibold text-slate-700">Transferí {PRECIO} a este alias</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono text-sm font-black text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">{ALIAS}</span>
                  <button onClick={copyAlias} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-[13px] font-semibold text-slate-700">Avisanos por WhatsApp</p>
                <p className="text-[12px] text-slate-400 mb-2">Te activamos la cuenta al instante</p>
                <button
                  onClick={sendWA}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Confirmar pago por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        {isTrialExpired && (
          <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
            <Zap className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-[13px] font-semibold text-green-700">Plan Negocio: {PRECIO}/mes · Todo incluido</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ¿Consultas? Escribinos a{' '}
          <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">WhatsApp</a>
        </p>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CreditCard, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatSubscriptionDate } from '../utils/subscriptionDates'
import {
  cancelMercadoPagoSubscription,
  changeMercadoPagoPlan,
  startMercadoPagoSubscription,
  syncMercadoPagoSubscription,
} from '../mercadoPagoService'
import PlanPicker from './PlanPicker'
import { PLANS, formatPlanPrice, normalizePlan, type PlanId, PLAN_ORDER } from '@/config/plans'
const POLL_INTERVAL_MS = 8000
const POLL_DURATION_MS = 5 * 60 * 1000

/** Débito automático mensual con Mercado Pago (opción recomendada frente a la transferencia manual). */
export default function MercadoPagoSubscriptionCard({
  compact = false,
  plan: controlledPlan,
  onPlanChange,
}: {
  compact?: boolean
  /** Si el contenedor ya muestra el selector de plan, lo controla desde afuera. */
  plan?: PlanId
  onPlanChange?: (plan: PlanId) => void
}) {
  const { user, profile } = useAuthStore()
  const { business, fetchBusiness } = useBusinessStore()
  const { isOnline } = useOnlineStatus()
  const [email, setEmail] = useState('')
  const [linkedCount, setLinkedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const pollUntil = useRef(0)

  const [ownPlan, setOwnPlan] = useState<PlanId>(normalizePlan(business?.plan))
  const plan = controlledPlan ?? ownPlan
  const setPlan = onPlanChange ?? setOwnPlan
  const currentPlan = normalizePlan(business?.plan)

  const status = business?.mp_subscription_status ?? null
  const isAdmin = profile?.role === 'admin'
  // El VIP incluye las sucursales vinculadas; en Básico y Premium cada negocio paga su plan.
  const amount = PLANS[plan].price

  useEffect(() => {
    setEmail(business?.mp_payer_email || user?.email || '')
  }, [business?.mp_payer_email, user?.email])

  useEffect(() => {
    supabase.rpc('get_linked_businesses' as any).then(({ data }) => setLinkedCount(((data as unknown[]) ?? []).length))
  }, [])

  async function refresh(silent = true) {
    if (!business) return
    try {
      const result = await syncMercadoPagoSubscription()
      await fetchBusiness(business.id)
      if (result.applied > 0) {
        setWaiting(false)
        toast.success('¡Pago recibido! Tu plan quedó activo.')
      } else if (!silent) {
        toast.info(result.status === 'authorized' ? 'Suscripción activa. El cobro puede tardar unos minutos en acreditarse.' : 'Todavía no recibimos la confirmación de Mercado Pago.')
      }
    } catch (error: any) {
      if (!silent) toast.error(error.message)
    }
  }

  // Mientras el cliente paga en el navegador, se consulta cada pocos segundos y al volver a CajaGo.
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      if (Date.now() > pollUntil.current) { setWaiting(false); return }
      refresh()
    }, POLL_INTERVAL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [waiting])

  async function subscribe() {
    if (!email.trim()) { toast.error('Ingresá el email de tu cuenta de Mercado Pago'); return }
    setBusy(true)
    try {
      await startMercadoPagoSubscription(email.trim(), plan)
      await fetchBusiness(business!.id)
      pollUntil.current = Date.now() + POLL_DURATION_MS
      setWaiting(true)
      toast.info('Completá el pago en la página de Mercado Pago que se abrió.')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function changePlan(next: PlanId) {
    const nextPlan = PLANS[next]
    if (!confirm(`¿Pasar al plan ${nextPlan.name}? Desde el próximo débito se cobran ${formatPlanPrice(nextPlan.price)} por mes.`)) return
    setBusy(true)
    try {
      await changeMercadoPagoPlan(next)
      await fetchBusiness(business!.id)
      toast.success(`Listo, ahora tenés el plan ${nextPlan.name}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!confirm('¿Cancelar el débito automático? Vas a seguir usando CajaGo hasta la fecha ya pagada.')) return
    setBusy(true)
    try {
      await cancelMercadoPagoSubscription()
      await fetchBusiness(business!.id)
      toast.success('Débito automático cancelado')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const box = `rounded-xl border border-white/[0.07] bg-white/[0.02] ${compact ? 'p-4' : 'p-5'}`

  if (status === 'authorized') {
    return (
      <div className={box}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Plan {PLANS[currentPlan].name} · débito automático activo con Mercado Pago</p>
            <p className="text-xs text-white/50 mt-1">
              {business?.mp_next_payment_at ? `Próximo cobro: ${formatSubscriptionDate(business.mp_next_payment_at)}` : 'Cada mes se cobra solo y tu plan se renueva.'}
              {business?.mp_payer_email ? ` · ${business.mp_payer_email}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => refresh(false)} disabled={!isOnline} className="px-3 h-8 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar estado
              </button>
              {isAdmin && PLAN_ORDER.filter(id => id !== currentPlan).map(id => (
                <button
                  key={id}
                  onClick={() => changePlan(id)}
                  disabled={busy || !isOnline}
                  className="px-3 h-8 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 disabled:opacity-40"
                >
                  Pasar a {PLANS[id].name}
                </button>
              ))}
              {isAdmin && (
                <button onClick={cancel} disabled={busy || !isOnline} className="px-3 h-8 rounded-lg text-red-300/80 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-40">
                  Cancelar débito automático
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4 text-white/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Débito automático con Mercado Pago</p>
          <p className="text-[13px] text-white/50 mt-1">
            Plan {PLANS[plan].name}: {formatPlanPrice(amount)} por mes. Con tarjeta o dinero en cuenta; se renueva solo y lo cancelás cuando quieras.
          </p>
          {linkedCount > 0 && (
            <p className="text-[12px] mt-1.5 text-white/40">
              {plan === 'vip'
                ? `Incluye ${linkedCount === 1 ? 'tu sucursal vinculada' : `tus ${linkedCount} sucursales vinculadas`}.`
                : 'Las sucursales vinculadas solo están incluidas en el VIP: con este plan cada negocio paga su suscripción.'}
            </p>
          )}

          {status === 'cancelled' && (
            <p className="text-xs text-amber-300 mt-2">El débito automático está cancelado. Podés volver a activarlo.</p>
          )}

          {!isAdmin ? (
            <p className="text-xs text-white/40 mt-3">Pedile al administrador del negocio que active la suscripción.</p>
          ) : waiting || status === 'pending' ? (
            <div className="mt-3 space-y-2">
              {waiting && (
                <p className="text-xs text-[#9aa9ff] flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Esperando la confirmación de Mercado Pago...
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => refresh(false)} disabled={!isOnline} className="px-3 h-9 rounded-lg bg-[#6178ee] text-white text-xs font-semibold hover:bg-[#6f8cff] disabled:opacity-40">
                  Ya pagué, verificar
                </button>
                <button onClick={subscribe} disabled={busy || !isOnline} className="px-3 h-9 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 disabled:opacity-40">
                  {busy ? 'Abriendo...' : 'Abrir Mercado Pago de nuevo'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {!onPlanChange && <PlanPicker value={plan} onChange={setPlan} compact={compact} />}
              <label className="block text-[11px] font-medium text-white/50">Email de tu cuenta de Mercado Pago</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu-email@ejemplo.com"
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-[#9aa9ff]/50"
              />
              <button
                onClick={subscribe}
                disabled={busy || !isOnline}
                className="w-full h-10 rounded-lg bg-[#6178ee] text-white text-sm font-semibold hover:bg-[#6f8cff] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isOnline ? 'Suscribirme con Mercado Pago' : 'Necesitás conexión para suscribirte'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

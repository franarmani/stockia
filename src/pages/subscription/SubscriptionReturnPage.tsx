import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import CajaGoBrand from '@/components/brand/CajaGoBrand'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { syncMercadoPagoSubscription } from '@/features/subscription/mercadoPagoService'

// Mercado Pago redirige acá (back_url) al terminar el checkout de la suscripción.
// Se abre en el navegador, incluso si el cliente usa el programa de escritorio.
export default function SubscriptionReturnPage() {
  const { user, profile } = useAuthStore()
  const { business, fetchBusiness } = useBusinessStore()
  const [checking, setChecking] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!user || !profile?.business_id) return
    setChecking(true)
    syncMercadoPagoSubscription()
      .then(() => fetchBusiness(profile.business_id))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [user, profile?.business_id])

  useEffect(() => {
    setActive(business?.mp_subscription_status === 'authorized')
  }, [business?.mp_subscription_status])

  return (
    <div className="min-h-screen bg-[#090c11] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121923] p-8 text-center">
        <div className="flex justify-center mb-6"><CajaGoBrand size="sm" /></div>
        {checking ? (
          <Loader2 className="w-10 h-10 text-[#8da0ff] animate-spin mx-auto" />
        ) : (
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        )}
        <h1 className="mt-5 text-xl font-bold text-white">
          {active ? '¡Suscripción activa!' : 'Recibimos tu suscripción'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {active
            ? 'Tu plan se renueva solo cada mes con Mercado Pago.'
            : 'Mercado Pago está confirmando el pago. En unos minutos tu plan se activa solo.'}
          {' '}Ya podés cerrar esta pestaña y volver a CajaGo.
        </p>
        {user && profile && (
          <Link to="/menu" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#7087f5] px-6 text-sm font-bold text-white hover:bg-[#8498fb]">
            Ir a CajaGo
          </Link>
        )}
      </div>
    </div>
  )
}

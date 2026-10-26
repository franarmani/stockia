import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, QrCode } from 'lucide-react'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { openExternal } from '@/desktop/openExternal'
import { mpQr, type MpQrStatus } from './mpQrService'
import { AR_PROVINCES } from '@/config/businessTypes'

const PROVINCES = AR_PROVINCES

/** Conectar la cuenta de Mercado Pago del negocio y preparar su caja para cobrar con QR. */
export default function MpQrSettingsCard() {
  const { isPremium } = usePlan()
  const { isOnline } = useOnlineStatus()
  const profile = useAuthStore((state) => state.profile)
  const business = useBusinessStore((state) => state.business)
  const [status, setStatus] = useState<MpQrStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [address, setAddress] = useState({ street_name: '', street_number: '', city: business?.city?.split(',')[0] ?? '', state_name: 'Buenos Aires' })
  const isAdmin = profile?.role === 'admin'

  async function refresh() {
    try {
      const result = await mpQr.status()
      setStatus(result)
      if (result.connected) setWaiting(false)
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    if (isPremium && isOnline) refresh()
  }, [isPremium, isOnline])

  // Mientras el comercio autoriza en el navegador, se revisa al volver a CajaGo.
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(refresh, 4000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [waiting])

  async function connect() {
    setBusy(true)
    try {
      const { url } = await mpQr.connectUrl()
      await openExternal(url)
      setWaiting(true)
      toast.info('Autorizá a CajaGo en la página de Mercado Pago que se abrió')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function setupPos() {
    setBusy(true)
    try {
      await mpQr.setupPos(address)
      toast.success('Caja de Mercado Pago lista: ya podés cobrar con QR')
      refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar la cuenta de Mercado Pago? Dejás de poder cobrar con QR desde CajaGo.')) return
    setBusy(true)
    try {
      await mpQr.disconnect()
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-[#009ee3]/50'

  return (
    <div className="rounded-2xl border border-[#009ee3]/25 bg-[#009ee3]/[0.06] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-[#4fc3f7]" />
        <h3 className="font-semibold text-white">Cobro con QR de Mercado Pago</h3>
      </div>

      {!isPremium ? (
        <p className="text-sm text-white/50">Disponible en el plan Premium. El cliente escanea un QR en la caja y el pago entra a tu cuenta de Mercado Pago.</p>
      ) : !isOnline ? (
        <p className="text-sm text-white/50">Necesitás conexión para configurar el cobro con QR.</p>
      ) : !status?.connected ? (
        <>
          <p className="text-sm text-white/60">
            Conectá la cuenta de Mercado Pago del negocio. Cada venta genera un QR en pantalla, el cliente lo paga con su app y la venta se registra sola. El dinero entra directo a tu cuenta.
          </p>
          {isAdmin ? (
            <button onClick={connect} disabled={busy} className="h-10 px-5 rounded-xl bg-[#009ee3] text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
              {(busy || waiting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {waiting ? 'Esperando autorización…' : 'Conectar Mercado Pago'}
            </button>
          ) : (
            <p className="text-xs text-white/40">Pedile al administrador del negocio que conecte la cuenta.</p>
          )}
        </>
      ) : !status.pos_ready ? (
        <>
          <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Cuenta conectada{status.nickname ? `: ${status.nickname}` : ''}</p>
          <p className="text-sm text-white/60">Último paso: Mercado Pago pide la dirección del local para crear tu caja.</p>
          <div className="grid sm:grid-cols-[1fr_120px] gap-3">
            <input className={input} placeholder="Calle" value={address.street_name} onChange={e => setAddress({ ...address, street_name: e.target.value })} />
            <input className={input} placeholder="Número" value={address.street_number} onChange={e => setAddress({ ...address, street_number: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={input} placeholder="Ciudad" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
            <select className={input} value={address.state_name} onChange={e => setAddress({ ...address, state_name: e.target.value })}>
              {PROVINCES.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
            </select>
          </div>
          {isAdmin && (
            <button onClick={setupPos} disabled={busy} className="h-10 px-5 rounded-xl bg-[#009ee3] text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear caja
            </button>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Listo para cobrar con QR{status.nickname ? ` · ${status.nickname}` : ''}</p>
          <p className="text-xs text-white/50">En el punto de venta elegí "QR Mercado Pago" como medio de pago.</p>
          {isAdmin && (
            <button onClick={disconnect} disabled={busy} className="h-8 px-3 rounded-lg text-red-300/80 text-xs font-semibold hover:bg-red-500/10">Desconectar cuenta</button>
          )}
        </div>
      )}
    </div>
  )
}

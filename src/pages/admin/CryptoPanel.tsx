import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PLANS, type PlanId } from '@/config/plans'
import { whatsappLink } from '../../../supabase/functions/_shared/adminAlerts'

interface Settings {
  enabled: boolean
  wallet_address: string
  network: string
  platform: string
  instructions: string
  price_basic_usdt: string
  price_premium_usdt: string
  price_vip_usdt: string
}

interface Payment {
  id: string
  business_id: string
  plan: PlanId
  expected_usdt: number
  received_usdt: number | null
  network: string | null
  wallet_address: string | null
  tx_hash: string | null
  paid_at: string | null
  customer_note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  business?: { name: string; phone: string | null; email: string | null } | null
}

const EMPTY: Settings = { enabled: false, wallet_address: '', network: 'TRC20', platform: '', instructions: '', price_basic_usdt: '', price_premium_usdt: '', price_vip_usdt: '' }
const num = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))

/** Panel del administrador: configuración del pago en USDT y revisión de los pagos informados. */
export default function CryptoPanel() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState<{ payment: Payment; received: string; hash: string; paidAt: string; note: string } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: config }, { data: rows }] = await Promise.all([
      (supabase as any).from('crypto_settings').select('*').eq('id', 'main').maybeSingle(),
      (supabase as any).from('crypto_payments').select('*, business:businesses(name, phone, email)').order('created_at', { ascending: false }).limit(100),
    ])
    if (config) {
      setSettings({
        enabled: !!config.enabled, wallet_address: config.wallet_address ?? '', network: config.network ?? '', platform: config.platform ?? '',
        instructions: config.instructions ?? '', price_basic_usdt: config.price_basic_usdt ?? '', price_premium_usdt: config.price_premium_usdt ?? '', price_vip_usdt: config.price_vip_usdt ?? '',
      })
    }
    setPayments(rows ?? [])
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  async function save() {
    if (settings.enabled && (!settings.wallet_address.trim() || !settings.network.trim())) { toast.error('Para activarlo cargá la dirección y la red'); return }
    setSaving(true)
    const { error } = await (supabase as any).from('crypto_settings').update({
      enabled: settings.enabled,
      wallet_address: settings.wallet_address.trim() || null,
      network: settings.network.trim() || null,
      platform: settings.platform.trim() || null,
      instructions: settings.instructions.trim() || null,
      price_basic_usdt: num(String(settings.price_basic_usdt)),
      price_premium_usdt: num(String(settings.price_premium_usdt)),
      price_vip_usdt: num(String(settings.price_vip_usdt)),
      updated_at: new Date().toISOString(),
    }).eq('id', 'main')
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Configuración de USDT guardada')
  }

  async function decide(action: 'approve' | 'reject') {
    if (!review) return
    const { payment } = review
    const { error } = await (supabase as any).rpc('review_crypto_payment', {
      p_id: payment.id, p_action: action,
      p_received: action === 'approve' ? num(review.received) : null,
      p_tx_hash: review.hash.trim() || null,
      p_paid_at: review.paidAt ? new Date(review.paidAt).toISOString() : null,
      p_note: review.note.trim() || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success(action === 'approve' ? 'Pago aprobado: la suscripción quedó activa' : 'Pago rechazado')
    setReview(null)
    load().catch(() => {})
  }

  const input = 'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-primary/40 focus:outline-none'
  const pending = payments.filter((payment) => payment.status === 'pending')

  if (loading) return <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-white/30" /></div>

  return (
    <div className="space-y-6">
      <div className="glass-card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Pago en USDT (clientes del exterior)</h2>
            <p className="text-xs text-white/40">Solo la dirección de recepción. Nunca cargues claves privadas ni frases semilla.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} /> Activado
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-white/50">Dirección de recepción<input className={input} value={settings.wallet_address} onChange={(e) => setSettings({ ...settings, wallet_address: e.target.value })} placeholder="TXXXXXXXX…" /></label>
          <label className="space-y-1 text-xs text-white/50">Red<input className={input} value={settings.network} onChange={(e) => setSettings({ ...settings, network: e.target.value })} placeholder="TRC20, BEP20, Polygon…" /></label>
          <label className="space-y-1 text-xs text-white/50">Plataforma<input className={input} value={settings.platform} onChange={(e) => setSettings({ ...settings, platform: e.target.value })} placeholder="Lemon Cash, BingX…" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([['price_basic_usdt', 'Básico'], ['price_premium_usdt', 'Premium'], ['price_vip_usdt', 'VIP']] as const).map(([key, name]) => (
            <label key={key} className="space-y-1 text-xs text-white/50">Precio {name} (USDT / mes)
              <input className={input} inputMode="decimal" value={String(settings[key])} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} placeholder="Sin precio = no disponible" />
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-xs text-white/50">Instrucciones para el cliente
          <textarea className={cn(input, 'h-24 py-2')} value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} placeholder="Ej: enviá el monto exacto y copiá el TXID." />
        </label>
        <button onClick={save} disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/8 p-4">
          <h2 className="font-semibold text-white">Pagos informados {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-2 text-[11px] font-black text-white">{pending.length} pendientes</span>}</h2>
          <button onClick={() => load()} className="text-white/50 hover:text-white" aria-label="Actualizar"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {payments.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/40">Todavía no hay pagos en USDT.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {payments.map((payment) => {
              const wa = whatsappLink(payment.business?.phone, `Hola! Soy de CajaGo. Recibí tu pago en USDT de ${payment.business?.name ?? 'tu negocio'}.`)
              return (
                <div key={payment.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-semibold text-white">{payment.business?.name ?? payment.business_id}</p>
                    <p className="text-xs text-white/50">{PLANS[payment.plan].name} · {payment.expected_usdt} USDT{payment.network ? ` (${payment.network})` : ''} · {new Date(payment.created_at).toLocaleString('es-AR')}</p>
                    {payment.tx_hash && <p className="break-all text-[11px] text-white/40">TXID: {payment.tx_hash}</p>}
                    {payment.customer_note && <p className="text-xs text-white/60">“{payment.customer_note}”</p>}
                  </div>
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', payment.status === 'pending' ? 'bg-amber-500/10 text-amber-300' : payment.status === 'approved' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>
                    {payment.status === 'pending' ? 'Pendiente' : payment.status === 'approved' ? `Aprobado · ${payment.received_usdt} USDT` : 'Rechazado'}
                  </span>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="h-8 rounded-lg bg-white/5 px-3 text-xs font-semibold leading-8 text-white/70 hover:bg-white/10">WhatsApp</a>}
                  {payment.status === 'pending' && (
                    <button onClick={() => setReview({ payment, received: String(payment.expected_usdt), hash: payment.tx_hash ?? '', paidAt: new Date().toISOString().slice(0, 16), note: '' })}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:brightness-110">Revisar</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {review && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setReview(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#0d1b2d] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white">Revisar pago · {review.payment.business?.name}</h3>
            <p className="text-xs text-white/50">Esperado: {review.payment.expected_usdt} USDT ({PLANS[review.payment.plan].name}). Verificá en tu billetera que llegó antes de aprobar.</p>
            {review.payment.wallet_address && (
              <button onClick={() => navigator.clipboard?.writeText(review.payment.wallet_address!)} className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white"><Copy className="h-3 w-3" /> Dirección usada: {review.payment.wallet_address.slice(0, 10)}…</button>
            )}
            <label className="block space-y-1 text-xs text-white/50">Cantidad recibida (USDT)<input className={input} inputMode="decimal" value={review.received} onChange={(e) => setReview({ ...review, received: e.target.value })} /></label>
            <label className="block space-y-1 text-xs text-white/50">TXID / hash (opcional)<input className={input} value={review.hash} onChange={(e) => setReview({ ...review, hash: e.target.value })} /></label>
            <label className="block space-y-1 text-xs text-white/50">Fecha y hora del pago<input type="datetime-local" className={input} value={review.paidAt} onChange={(e) => setReview({ ...review, paidAt: e.target.value })} /></label>
            <label className="block space-y-1 text-xs text-white/50">Nota (se muestra al cliente si lo rechazás)<input className={input} value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => decide('reject')} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500/15 text-sm font-bold text-red-300 hover:bg-red-500/25"><X className="h-4 w-4" /> Rechazar</button>
              <button onClick={() => decide('approve')} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:brightness-110"><Check className="h-4 w-4" /> Aprobar y activar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { Check, ChevronDown, Clock, Copy, Globe, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PLANS, PLAN_ORDER, type PlanId } from '@/config/plans'

interface CryptoSettings {
  enabled: boolean
  wallet_address: string | null
  network: string | null
  platform: string | null
  instructions: string | null
  price_basic_usdt: number | null
  price_premium_usdt: number | null
  price_vip_usdt: number | null
}

interface CryptoPayment {
  id: string
  plan: PlanId
  expected_usdt: number
  received_usdt: number | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  tx_hash: string | null
  created_at: string
}

const priceOf = (settings: CryptoSettings, plan: PlanId) =>
  plan === 'basic' ? settings.price_basic_usdt : plan === 'premium' ? settings.price_premium_usdt : settings.price_vip_usdt

const STATUS = {
  pending: { label: 'Pendiente de verificación', className: 'bg-amber-500/10 text-amber-300', Icon: Clock },
  approved: { label: 'Aprobado', className: 'bg-emerald-500/10 text-emerald-300', Icon: Check },
  rejected: { label: 'Rechazado', className: 'bg-red-500/10 text-red-300', Icon: XCircle },
} as const

/** Pago del plan en USDT para clientes de otros países. Manual: el cliente informa y el administrador verifica. */
export default function CryptoPaymentCard({ initialPlan = 'premium', defaultOpen = false }: { initialPlan?: PlanId; defaultOpen?: boolean }) {
  const [settings, setSettings] = useState<CryptoSettings | null>(null)
  const [payments, setPayments] = useState<CryptoPayment[]>([])
  const [open, setOpen] = useState(defaultOpen)
  const [plan, setPlan] = useState<PlanId>(initialPlan)
  const [txHash, setTxHash] = useState('')
  const [note, setNote] = useState('')
  const [qr, setQr] = useState('')
  const [sending, setSending] = useState(false)

  async function load() {
    const [{ data: config }, { data: mine }] = await Promise.all([
      (supabase as any).from('crypto_settings').select('*').eq('id', 'main').maybeSingle(),
      (supabase as any).from('crypto_payments').select('id, plan, expected_usdt, received_usdt, status, admin_note, tx_hash, created_at').order('created_at', { ascending: false }).limit(10),
    ])
    setSettings(config ?? null)
    setPayments(mine ?? [])
  }

  useEffect(() => { load().catch(() => {}) }, [])
  useEffect(() => {
    if (!open || !settings?.wallet_address) return
    QRCode.toDataURL(settings.wallet_address, { width: 360, margin: 2 }).then(setQr).catch(() => setQr(''))
  }, [open, settings?.wallet_address])

  if (!settings?.enabled || !settings.wallet_address) return null
  const price = priceOf(settings, plan)
  const hasPending = payments.some((payment) => payment.status === 'pending')

  async function copy() {
    try { await navigator.clipboard.writeText(settings!.wallet_address!); toast.success('Dirección copiada') }
    catch { toast.error('No se pudo copiar: seleccionala y copiala a mano') }
  }

  async function report() {
    setSending(true)
    const { error } = await (supabase as any).rpc('report_crypto_payment', { p_plan: plan, p_tx_hash: txHash.trim() || null, p_note: note.trim() || null })
    setSending(false)
    if (error) { toast.error(error.message); return }
    toast.success('Listo: tu pago quedó pendiente de verificación. Te avisamos apenas lo confirmemos.')
    setTxHash(''); setNote('')
    load().catch(() => {})
  }

  const input = 'h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-primary/50 focus:outline-none'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left">
        <Globe className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Pagar desde el exterior (USDT)</span>
          <span className="block text-xs text-white/50">Transferí USDT y avisanos: lo verificamos y activamos tu plan.</span>
        </span>
        {hasPending && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Pendiente</span>}
        <ChevronDown className={cn('h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/8 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-white/60">1 · Elegí el plan</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLAN_ORDER.map((id) => {
                const value = priceOf(settings, id)
                if (value === null) return null
                return (
                  <button key={id} onClick={() => setPlan(id)}
                    className={cn('rounded-xl border p-3 text-left transition', plan === id ? 'border-primary bg-primary/10' : 'border-white/10 hover:bg-white/5')}>
                    <p className="text-sm font-bold text-white">{PLANS[id].name}</p>
                    <p className="text-lg font-bold tabular-nums text-white">{value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-white/50">USDT / mes</span></p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-white/60">2 · Transferí exactamente {price?.toLocaleString('es-AR', { maximumFractionDigits: 2 })} USDT</p>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              {qr && <img src={qr} alt="QR de la dirección de depósito" className="mx-auto h-40 w-40 rounded-xl bg-white p-1.5" />}
              <div className="min-w-0 space-y-2 text-sm">
                <p><span className="text-white/50">Red: </span><b className="text-white">{settings.network ?? '—'}</b></p>
                {settings.platform && <p><span className="text-white/50">Plataforma: </span><b className="text-white">{settings.platform}</b></p>}
                <p className="text-white/50">Dirección de depósito:</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-3 py-2 text-xs text-white">{settings.wallet_address}</code>
                  <button onClick={copy} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/15" aria-label="Copiar dirección"><Copy className="h-4 w-4" /></button>
                </div>
                <p className="text-[11px] text-amber-200/80">Enviá solo USDT por la red indicada. Si usás otra red, el dinero se pierde.</p>
              </div>
            </div>
            {settings.instructions && <p className="mt-3 whitespace-pre-line rounded-xl bg-white/5 p-3 text-xs text-white/70">{settings.instructions}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-white/60">3 · Avisanos que pagaste</p>
            <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="TXID / hash de la transacción (opcional)" className={input} maxLength={200} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className={input} maxLength={500} />
            <button onClick={report} disabled={sending || price === null}
              className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">
              {sending ? 'Enviando…' : 'Ya hice el pago'}
            </button>
          </div>

          {payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/60">Tus pagos</p>
              {payments.map((payment) => {
                const status = STATUS[payment.status]
                return (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 p-3 text-xs">
                    <span className="text-white/80">{PLANS[payment.plan].name} · {(payment.received_usdt ?? payment.expected_usdt).toLocaleString('es-AR')} USDT · {new Date(payment.created_at).toLocaleDateString('es-AR')}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold', status.className)}><status.Icon className="h-3 w-3" /> {status.label}</span>
                    {payment.status === 'rejected' && payment.admin_note && <span className="w-full text-white/50">Motivo: {payment.admin_note}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

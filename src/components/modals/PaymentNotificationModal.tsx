import MercadoPagoSubscriptionCard from '@/features/subscription/components/MercadoPagoSubscriptionCard'
import PlanPicker from '@/features/subscription/components/PlanPicker'
import { PLANS, formatPlanPrice, normalizePlan, type PlanId } from '@/config/plans'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { toast } from 'sonner'
import {
  Copy, MessageCircle, Upload, CheckCircle2,
  X, ImageIcon, Loader2, CreditCard, ExternalLink, ChevronRight, LogOut
} from 'lucide-react'

const ALIAS = 'farmani2.ppay'
const WA_NUMBER = '5492915716099'

export default function PaymentNotificationModal({ onClose, daysLeft }: { onClose?: () => void; daysLeft?: number }) {
  const { user, profile, signOut } = useAuthStore()
  const { business } = useBusinessStore()
  const [tab, setTab] = useState<'mp' | 'transfer'>('mp')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [plan, setPlan] = useState<PlanId>(normalizePlan(useBusinessStore.getState().business?.plan))
  const [linked, setLinked] = useState<{ id: string; name: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.rpc('get_linked_businesses').then(({ data }) => setLinked((data as unknown as { id: string; name: string }[]) ?? []))
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    if (!onClose) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const PRECIO = formatPlanPrice(PLANS[plan].price)
  const linkedNames = linked.map(b => b.name).join(', ')

  function copyAlias() {
    navigator.clipboard.writeText(ALIAS)
    toast.success('Alias copiado')
  }

  function sendWA() {
    const msg = `Hola! Quisiera activar mi cuenta en CajaGo (plan ${PLANS[plan].name}). Ya realicé el pago de ${PRECIO} al alias ${ALIAS}. Mi email es: ${user?.email ?? ''} — Negocio: ${business?.name ?? ''}. Adjunto el comprobante, gracias!`
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5 MB'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file || !profile || !business) { toast.error('Adjuntá el comprobante primero'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${business.id}/activation_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: true })

      if (upErr) throw new Error(upErr.message)

      const { error: reqErr } = await supabase.from('payment_requests').insert({
        business_id: business.id,
        user_id: profile.id,
        amount: PRECIO,
        proof_url: path,
        status: 'pending',
        plan,
        note: 'Solicitud de activación inicial'
      })

      if (reqErr) throw new Error(reqErr.message)

      setSubmitted(true)
      toast.success('Recibimos tu comprobante. Te activamos la cuenta apenas lo revisemos.')
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar')
    }
    setUploading(false)
  }

  const titleText =
    daysLeft === 0
      ? 'Tu mensualidad vence hoy'
      : daysLeft === 1
      ? 'Mañana se vence tu mensualidad'
      : typeof daysLeft === 'number' && daysLeft > 1
      ? `Tu mensualidad vence en ${daysLeft} días`
      : 'Activá tu plan'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(5, 11, 22, 0.94)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[88vh] flex flex-col bg-[#0b1322] text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header compacto con botón cerrar */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0e172a] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {titleText}
                </h2>
                <p className="text-xs text-slate-300">
                  Monto a abonar: <span className="text-primary font-bold">{PRECIO}</span> <span className="text-slate-400">({PLANS[plan].name})</span>
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Cerrar (Esc)"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {linked.length > 0 && (
            <p className="mt-2 text-[11px] text-sky-200 bg-sky-950/60 border border-sky-500/30 rounded-lg px-2.5 py-1 leading-snug">
              🔗 Vinculada con <b className="text-white">{linkedNames}</b> (con este pago se renuevan ambas cuentas juntas).
            </p>
          )}
        </div>

        {/* Pestañas de método de pago */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.08] gap-1">
            <button
              type="button"
              onClick={() => setTab('mp')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                tab === 'mp'
                  ? 'bg-[#009ee3] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Mercado Pago</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('transfer')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                tab === 'transfer'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <span>🏦 Transferencia bancaria</span>
            </button>
          </div>
        </div>

        {/* Cuerpo scrolleable con min-h-0 para que nunca desborde */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          {/* Selector de plan compacto */}
          <PlanPicker value={plan} onChange={setPlan} compact />

          {tab === 'mp' ? (
            <MercadoPagoSubscriptionCard compact plan={plan} onPlanChange={setPlan} />
          ) : submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">¡Comprobante recibido!</h3>
              <p className="text-xs text-slate-300 mb-4 max-w-sm mx-auto">
                Lo revisamos y activamos tu cuenta por 30 días{plan === 'vip' && linked.length > 0 && <> (también la de {linkedNames})</>}, normalmente en el día. Si querés acelerarlo, avisanos por WhatsApp.
              </p>
              <button
                onClick={sendWA}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/15 text-primary rounded-xl text-xs font-bold hover:bg-primary/25 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Avisar por WhatsApp
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Step 1 - Transfer */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="text-xs font-semibold text-slate-200">Transferí {PRECIO} al alias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/[0.08] px-3 py-2 rounded-xl font-mono text-xs sm:text-sm font-bold text-white text-center tracking-wider select-all">
                    {ALIAS}
                  </div>
                  <button
                    onClick={copyAlias}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-primary/15 hover:border-primary/30 flex items-center justify-center transition-all shrink-0 group"
                    title="Copiar alias"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary" />
                  </button>
                </div>
              </div>

              {/* Step 2 - Upload */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="text-xs font-semibold text-slate-200">Subí el comprobante</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFile}
                />
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08] aspect-video bg-white/5 max-h-36">
                    <img src={preview} alt="Comprobante" className="w-full h-full object-contain" />
                    <button
                      onClick={() => { setFile(null); setPreview(null) }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Eliminar comprobante"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-5 border-2 border-dashed border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
                  >
                    <ImageIcon className="w-4 h-4 text-slate-500 group-hover:text-primary/70" />
                    <span className="text-xs font-medium text-slate-400 group-hover:text-primary/70">Adjuntar foto o PDF</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!file || uploading}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-xs text-white bg-primary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Enviar y activar cuenta</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer compacto */}
        <div className="px-5 py-2.5 border-t border-white/[0.06] bg-[#0e172a]/80 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={sendWA}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Consultar por WhatsApp</span>
          </button>
          {onClose ? (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

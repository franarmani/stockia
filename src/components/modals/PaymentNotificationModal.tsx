import MercadoPagoSubscriptionCard from '@/features/subscription/components/MercadoPagoSubscriptionCard'
import PlanPicker from '@/features/subscription/components/PlanPicker'
import { PLANS, formatPlanPrice, normalizePlan, type PlanId } from '@/config/plans'
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

      // La cuenta se activa cuando el superadmin aprueba el comprobante (approve_payment_request).
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
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-[#0b1322] text-slate-100 border border-slate-700/80 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo siempre visible arriba con botón cerrar prominent */}
        <div className="px-5 pt-4 pb-3.5 border-b border-white/[0.08] bg-[#0e172a] shrink-0 sticky top-0 z-20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {titleText}
                </h2>
                <p className="text-xs text-slate-300">
                  Monto a pagar: <span className="text-primary font-bold">{PRECIO}</span>
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
          <p className="mt-2 text-[12px] text-slate-400 leading-snug">
            {PLANS[plan].tagline} Facturación ARCA ilimitada y usuarios ilimitados en los dos planes.
          </p>
          {linked.length > 0 && (
            <p className="mt-2.5 text-[12px] text-sky-200 bg-sky-950/60 border border-sky-500/30 rounded-xl px-3 py-1.5 leading-snug">
              Esta cuenta está vinculada con <b className="text-white">{linkedNames}</b>. Con este pago se renuevan ambas cuentas, no hace falta pagar desde cada panel.
            </p>
          )}
        </div>

        {/* Cuerpo scrolleable para que nunca se desborde fuera de la pantalla */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">¡Comprobante recibido!</h3>
              <p className="text-sm text-slate-300 mb-6">
                Lo revisamos y activamos tu cuenta por 30 días{plan === 'vip' && linked.length > 0 && <> (también la de {linkedNames})</>}, normalmente en el día. Si querés acelerarlo, avisanos por WhatsApp.
              </p>
              <button
                onClick={sendWA}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/15 text-primary rounded-xl text-sm font-bold hover:bg-primary/25 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Avisar por WhatsApp
              </button>
            </div>
          ) : (
            <>
              <PlanPicker value={plan} onChange={setPlan} compact />
              <MercadoPagoSubscriptionCard compact plan={plan} onPlanChange={setPlan} />
              <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">o pagá por transferencia</p>

              {/* Step 1 - Transfer */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="text-xs font-semibold text-slate-200">Transferí al alias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/[0.08] px-3.5 py-2.5 rounded-xl font-mono text-sm font-bold text-white text-center tracking-wider select-all">
                    {ALIAS}
                  </div>
                  <button
                    onClick={copyAlias}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-primary/15 hover:border-primary/30 flex items-center justify-center transition-all shrink-0 group"
                    title="Copiar alias"
                  >
                    <Copy className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                  </button>
                </div>
              </div>

              {/* Step 2 - Upload */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
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
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08] aspect-video bg-white/5">
                    <img src={preview} alt="Comprobante" className="w-full h-full object-contain" />
                    <button
                      onClick={() => { setFile(null); setPreview(null) }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Eliminar comprobante"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group"
                  >
                    <ImageIcon className="w-5 h-5 text-slate-500 group-hover:text-primary/70" />
                    <span className="text-xs font-medium text-slate-400 group-hover:text-primary/70">Adjuntar comprobante</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={!file || uploading}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white bg-primary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Enviar y activar cuenta</>
                  )}
                </button>

                <button
                  onClick={sendWA}
                  className="w-full h-10 flex items-center justify-between px-3.5 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                    Contactar por WhatsApp
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                </button>

                {onClose ? (
                  <button
                    onClick={onClose}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-xl font-medium text-xs text-slate-400 hover:text-white bg-transparent hover:bg-white/[0.05] transition-all"
                  >
                    Cerrar y continuar en CajaGo
                  </button>
                ) : (
                  <button
                    onClick={() => signOut()}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-xl font-medium text-xs text-slate-400 hover:text-white/80 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    Cerrar sesión
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

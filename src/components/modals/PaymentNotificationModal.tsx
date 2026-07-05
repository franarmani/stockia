import { useState, useRef } from 'react'
import { addDays } from 'date-fns'
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
const PRECIO = '$70.000'

export default function PaymentNotificationModal({ onClose, daysLeft }: { onClose?: () => void; daysLeft?: number }) {
  const { user, profile, signOut } = useAuthStore()
  const { business, updateBusiness } = useBusinessStore()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function copyAlias() {
    navigator.clipboard.writeText(ALIAS)
    toast.success('Alias copiado')
  }

  function sendWA() {
    const msg = `Hola! Quisiera activar mi cuenta en STOCKIA HUB. Ya realicé el pago de ${PRECIO} al alias ${ALIAS}. Mi email es: ${user?.email ?? ''} — Negocio: ${business?.name ?? ''}. Adjunto el comprobante, gracias!`
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

      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path)

      const { error: reqErr } = await supabase.from('payment_requests').insert({
        business_id: business.id,
        user_id: profile.id,
        amount: PRECIO,
        proof_url: urlData.publicUrl,
        status: 'pending',
        notes: 'Solicitud de activación inicial'
      })

      if (reqErr) throw new Error(reqErr.message)

      // Activación automática: confiamos en el comprobante y extendemos la
      // mensualidad al instante. Si luego resulta falso o no llegó, el
      // superadmin da de baja la cuenta manualmente desde /admin.
      const baseDate = business.trial_ends_at && new Date(business.trial_ends_at) > new Date()
        ? new Date(business.trial_ends_at)
        : new Date()
      const newTrialEndsAt = addDays(baseDate, 30).toISOString()
      await updateBusiness({ subscription_status: 'active', trial_ends_at: newTrialEndsAt })

      setSubmitted(true)
      toast.success('¡Pago acreditado! Tu cuenta ya está activa por 30 días más.')
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar')
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(7, 17, 31, 0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md bg-[#0d1b2d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
          {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {daysLeft === 0 ? 'Tu mensualidad vence hoy' : daysLeft === 1 ? 'Mañana se vence tu mensualidad' : daysLeft ? `Tu mensualidad vence en ${daysLeft} días` : 'Activá tu Plan Negocio'}
              </h2>
              <p className="text-sm text-white/50">Pagala ahora así no te quedás sin sistema: <span className="text-primary font-bold">{PRECIO}</span></p>
            </div>
          </div>
          <p className="text-[13px] text-white/40 leading-relaxed">
            Incluye facturación AFIP ilimitada, usuarios ilimitados y soporte prioritario.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">¡Cuenta activada!</h3>
              <p className="text-sm text-white/50 mb-6">
                Ya extendimos tu mensualidad 30 días. Guardá el comprobante por las dudas.
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
              {/* Step 1 - Transfer */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="text-sm font-semibold text-white">Transferí al alias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/[0.08] px-4 py-3 rounded-xl font-mono text-sm font-bold text-white text-center tracking-wider select-all">
                    {ALIAS}
                  </div>
                  <button
                    onClick={copyAlias}
                    className="w-11 h-11 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-primary/15 hover:border-primary/30 flex items-center justify-center transition-all shrink-0 group"
                  >
                    <Copy className="w-4 h-4 text-white/40 group-hover:text-primary" />
                  </button>
                </div>
              </div>

              {/* Step 2 - Upload */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="text-sm font-semibold text-white">Subí el comprobante</span>
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
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-10 border-2 border-dashed border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <ImageIcon className="w-6 h-6 text-white/20 group-hover:text-primary/60" />
                    <span className="text-xs font-medium text-white/30 group-hover:text-primary/60">Adjuntar comprobante</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={!file || uploading}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white bg-primary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Enviar y activar cuenta</>
                  )}
                </button>

                <button
                  onClick={sendWA}
                  className="w-full h-11 flex items-center justify-between px-4 rounded-xl font-medium text-sm text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    Contactar por WhatsApp
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                </button>

                <button
                  onClick={() => signOut()}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-medium text-sm text-white/30 hover:text-white/70 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

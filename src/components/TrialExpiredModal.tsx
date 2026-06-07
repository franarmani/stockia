import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { toast } from 'sonner'
import {
  Clock, Copy, MessageCircle, Upload, CheckCircle2,
  Zap, X, ImageIcon, Loader2, LogOut,
} from 'lucide-react'

const ALIAS = 'farmani2.ppay'
const WA_NUMBER = '5492915716099'
const PRECIO = '$70.000'

export default function TrialExpiredModal() {
  const { user, profile } = useAuthStore()
  const { business } = useBusinessStore()
  const { signOut } = useAuthStore()
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
    const msg = `Hola Fran! Acabo de hacer la transferencia de ${PRECIO} al alias ${ALIAS} para activar mi cuenta en STOCKIA. Mi email es: ${user?.email ?? ''} — ${business?.name ?? ''}. Quedo a la espera, gracias!`
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
      // Upload to storage
      const ext = file.name.split('.').pop()
      const path = `${business.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: true })

      if (upErr) throw new Error(upErr.message)

      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path)

      // Create payment request
      const { error: reqErr } = await supabase.from('payment_requests').insert({
        business_id: business.id,
        user_id: profile.id,
        amount: PRECIO,
        proof_url: urlData.publicUrl,
        status: 'pending',
      })

      if (reqErr) throw new Error(reqErr.message)

      setSubmitted(true)
      toast.success('¡Comprobante enviado! Te avisamos cuando se acredite.')
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar')
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full sm:max-w-md bg-[#0d1b2d] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white">Tu prueba gratuita terminó</h2>
                <p className="text-[12px] text-slate-500">Activá tu cuenta para seguir usando STOCKIA</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="Cerrar sesión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Price pill */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-[13px] font-bold text-blue-400">Plan Negocio: {PRECIO}/mes · Todo incluido</p>
          </div>

          {submitted ? (
            /* ── Success state ── */
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">¡Comprobante recibido!</h3>
              <p className="text-[13px] text-slate-400 max-w-xs mx-auto">
                Vamos a revisar tu pago y activar tu cuenta. Te avisamos por email o WhatsApp.
              </p>
              <button
                onClick={sendWA}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-[13px] font-bold rounded-xl transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Avisar por WhatsApp también
              </button>
            </div>
          ) : (
            <>
              {/* Steps */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3.5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cómo activar tu cuenta</p>

                {/* Step 1 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-slate-300">Transferí {PRECIO} a este alias</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-sm font-black text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex-1 text-center">
                        {ALIAS}
                      </span>
                      <button
                        onClick={copyAlias}
                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-slate-300">Adjuntá el comprobante</p>
                    <p className="text-[12px] text-slate-500 mb-2">Captura o foto de la transferencia</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFile}
                    />
                    {preview ? (
                      <div className="relative rounded-xl overflow-hidden border border-white/10">
                        <img src={preview} alt="Comprobante" className="w-full h-32 object-cover" />
                        <button
                          onClick={() => { setFile(null); setPreview(null) }}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="w-full h-20 border-2 border-dashed border-white/10 hover:border-blue-400/30 hover:bg-blue-500/5 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors"
                      >
                        <ImageIcon className="w-5 h-5 text-slate-500" />
                        <span className="text-[12px] text-slate-500">Tocá para adjuntar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-slate-300">Enviá y esperá la activación</p>
                    <p className="text-[12px] text-slate-500">Revisamos y activamos al instante</p>
                  </div>
                </div>
              </div>

              {/* Submit + WA buttons */}
              <button
                onClick={handleSubmit}
                disabled={!file || uploading}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!file || uploading ? 'bg-slate-400' : 'bg-primary hover:bg-primary/90'}`}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Enviar comprobante</>
                )}
              </button>

              <button
                onClick={sendWA}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-green-400 bg-green-500/10 hover:bg-green-500/15 border border-green-500/30 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                O avisar directamente por WhatsApp
              </button>
            </>
          )}
        </div>

        {/* Bottom logout button */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={() => signOut()}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

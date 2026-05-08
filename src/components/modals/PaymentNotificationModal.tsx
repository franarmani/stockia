import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { toast } from 'sonner'
import {
  Clock, Copy, MessageCircle, Upload, CheckCircle2,
  Zap, X, ImageIcon, Loader2, AlertCircle
} from 'lucide-react'

const ALIAS = 'farmani2.ppay'
const WA_NUMBER = '5492915716099'
const PRECIO = '$50.000'

export default function PaymentNotificationModal({ onClose }: { onClose?: () => void }) {
  const { user, profile } = useAuthStore()
  const { business } = useBusinessStore()
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
    const msg = `Hola! Quisiera activar mi cuenta en STOCKIA. Ya realicé el pago de ${PRECIO} al alias ${ALIAS}. Mi email es: ${user?.email ?? ''} — Negocio: ${business?.name ?? ''}. Adjunto el comprobante, gracias!`
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

      setSubmitted(true)
      toast.success('¡Comprobante enviado! Activaremos tu cuenta a la brevedad.')
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar')
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 text-center relative">
          <div className="absolute top-4 right-4">
            {onClose && (
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/30">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">¡Activá tu Plan Negocio!</h2>
          <p className="text-blue-100 text-sm font-medium">
            Para continuar usando todas las funciones de STOCKIA, debés realizar el pago de tu suscripción.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {submitted ? (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-green-100">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">¡Recibimos tu comprobante!</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mb-8">
                Estamos procesando tu pago. En breve tu cuenta quedará 100% activa.
              </p>
              <button
                onClick={sendWA}
                className="inline-flex items-center gap-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-500/30"
              >
                <MessageCircle className="w-5 h-5" />
                Avisar por WhatsApp ahora
              </button>
            </div>
          ) : (
            <>
              {/* Info Card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Total a abonar: {PRECIO}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Incluye Facturación AFIP ilimitada, Usuarios ilimitados y Soporte.</p>
                </div>
              </div>

              {/* Payment Steps */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-1">1</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-slate-800">Transferí al Alias</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl font-mono text-sm font-black text-slate-900 text-center">
                        {ALIAS}
                      </div>
                      <button
                        onClick={copyAlias}
                        className="w-11 h-11 rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center transition-all shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-1">2</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-slate-800">Subí el comprobante</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFile}
                    />
                    <div className="mt-2">
                      {preview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video">
                          <img src={preview} alt="Comprobante" className="w-full h-full object-cover" />
                          <button
                            onClick={() => { setFile(null); setPreview(null) }}
                            className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="w-full h-24 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group"
                        >
                          <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                          <span className="text-xs font-bold text-slate-400 group-hover:text-blue-600">Adjuntar transferencia</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={!file || uploading}
                  className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl font-black text-[15px] text-white transition-all disabled:opacity-50 disabled:grayscale"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}
                >
                  {uploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                  ) : (
                    <><Upload className="w-5 h-5" /> Enviar y Activar Cuenta</>
                  )}
                </button>

                <button
                  onClick={sendWA}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar por WhatsApp 2915716099
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

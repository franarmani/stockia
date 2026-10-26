import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, FileText, Gift, Lock, Mail, MapPin, Phone, Store, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCuit } from '@/features/purchases/cuit'
import { AR_PROVINCES, BUSINESS_TYPES } from '@/config/businessTypes'
import {
  BUSINESS_IVA_CONDITIONS, REGISTRATION_STEPS, emptyRegistration, registerBusiness, validateRegistrationStep,
  type RegistrationData,
} from './registration'

/** Registro en 3 pasos con todos los datos que CajaGo necesita para operar desde el primer día. */
export default function RegistrationForm({
  initialReferral = '',
  legalNotice,
  onRegistered,
}: {
  initialReferral?: string
  legalNotice?: React.ReactNode
  onRegistered: (result: { email: string; password: string; referralApplied: boolean }) => Promise<void> | void
}) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<RegistrationData>({ ...emptyRegistration, referralCode: initialReferral })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (patch: Partial<RegistrationData>) => setData(current => ({ ...current, ...patch }))

  async function next(event: React.FormEvent) {
    event.preventDefault()
    const error = validateRegistrationStep(step, data)
    if (error) { toast.error(error); return }
    if (step < REGISTRATION_STEPS.length - 1) { setStep(step + 1); return }

    setLoading(true)
    try {
      const result = await registerBusiness(data)
      await onRegistered({ email: data.email.trim().toLowerCase(), password: data.password, referralApplied: result.referralApplied })
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const field = 'w-full h-11 pl-10 pr-3 rounded-xl text-sm bg-white/[0.04] text-[#FCFCFD] placeholder:text-[#9CA6BA]/60 border border-white/[0.10] hover:border-white/20 focus:outline-none focus:ring-[3px] focus:ring-[#9aa9ff]/15 focus:border-[#9aa9ff]/60 transition-all'
  const label = 'block text-[12px] font-medium text-[#FCFCFD]/70 mb-1.5'
  const icon = 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA6BA] pointer-events-none'

  return (
    <form onSubmit={next} className="space-y-4">
      <ol className="flex items-center gap-2" aria-label="Pasos del registro">
        {REGISTRATION_STEPS.map((name, index) => (
          <li key={name} className="flex-1">
            <div className={cn('h-1 rounded-full', index <= step ? 'bg-[#9aa9ff]' : 'bg-white/10')} />
            <p className={cn('mt-1.5 text-[10px] font-semibold uppercase tracking-wider', index === step ? 'text-[#FCFCFD]' : 'text-[#9CA6BA]/60')}>
              {index < step ? <Check className="inline w-3 h-3 mr-0.5" /> : null}{name}
            </p>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <div>
            <label className={label}>Nombre del negocio</label>
            <div className="relative"><Store className={icon} />
              <input className={field} value={data.businessName} onChange={e => set({ businessName: e.target.value })} placeholder="Ej: Corralón El Puente" autoComplete="organization" autoFocus />
            </div>
          </div>
          <div>
            <label className={label}>Rubro</label>
            <div className="relative"><Building2 className={icon} />
              <select className={cn(field, 'appearance-none')} value={data.businessType} onChange={e => set({ businessType: e.target.value })}>
                <option value="" className="bg-[#0b1221]">Elegí tu rubro</option>
                {BUSINESS_TYPES.map(type => <option key={type.id} value={type.id} className="bg-[#0b1221]">{type.label}</option>)}
              </select>
            </div>
          </div>
          {data.businessType === 'otro' && (
            <div>
              <label className={label}>¿Cuál es tu rubro?</label>
              <input className={cn(field, 'pl-3')} value={data.businessTypeOther} onChange={e => set({ businessTypeOther: e.target.value })} placeholder="Ej: Vivero, Bicicletería" maxLength={60} />
            </div>
          )}
          <div>
            <label className={label}>Teléfono o WhatsApp del negocio</label>
            <div className="relative"><Phone className={icon} />
              <input className={field} value={data.phone} onChange={e => set({ phone: e.target.value })} placeholder="Ej: 291 555-1234" inputMode="tel" autoComplete="tel" />
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <label className={label}>Dirección del local</label>
            <div className="relative"><MapPin className={icon} />
              <input className={field} value={data.address} onChange={e => set({ address: e.target.value })} placeholder="Calle y número" autoComplete="street-address" autoFocus />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Ciudad</label>
              <input className={cn(field, 'pl-3')} value={data.city} onChange={e => set({ city: e.target.value })} placeholder="Ej: Bahía Blanca" autoComplete="address-level2" />
            </div>
            <div>
              <label className={label}>Provincia</label>
              <select className={cn(field, 'pl-3 appearance-none')} value={data.province} onChange={e => set({ province: e.target.value })}>
                {AR_PROVINCES.map(province => <option key={province} value={province} className="bg-[#0b1221]">{province}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>CUIT</label>
            <div className="relative"><FileText className={icon} />
              <input className={field} value={formatCuit(data.cuit)} onChange={e => set({ cuit: e.target.value })} placeholder="20-12345678-9" inputMode="numeric" />
            </div>
          </div>
          <div>
            <label className={label}>Razón social o nombre del titular</label>
            <input className={cn(field, 'pl-3')} value={data.razonSocial} onChange={e => set({ razonSocial: e.target.value })} placeholder="Como figura en ARCA" />
          </div>
          <div>
            <label className={label}>Condición frente al IVA</label>
            <div className="grid grid-cols-3 gap-2">
              {BUSINESS_IVA_CONDITIONS.map(condition => (
                <button type="button" key={condition.id} onClick={() => set({ ivaCondition: condition.id })}
                  className={cn('min-h-10 px-1.5 py-1.5 rounded-xl text-[11px] leading-tight font-semibold border transition-all', data.ivaCondition === condition.id ? 'border-[#9aa9ff]/60 bg-[#9aa9ff]/10 text-[#FCFCFD]' : 'border-white/10 text-[#9CA6BA] hover:bg-white/5')}>
                  {condition.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[#9CA6BA]/70">Lo usamos para tus comprobantes. La facturación electrónica se activa después en Configuración.</p>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <label className={label}>Tu nombre</label>
            <div className="relative"><User className={icon} />
              <input className={field} value={data.fullName} onChange={e => set({ fullName: e.target.value })} placeholder="Juan Pérez" autoComplete="name" autoFocus />
            </div>
          </div>
          <div>
            <label className={label}>Email</label>
            <div className="relative"><Mail className={icon} />
              <input type="email" className={field} value={data.email} onChange={e => set({ email: e.target.value })} placeholder="tu@email.com" autoComplete="email" />
            </div>
          </div>
          <div>
            <label className={label}>Contraseña</label>
            <div className="relative"><Lock className={icon} />
              <input type={showPassword ? 'text' : 'password'} className={cn(field, 'pr-10')} value={data.password} onChange={e => set({ password: e.target.value })} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA6BA] hover:text-[#FCFCFD]">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={label}>Código de referido (opcional)</label>
            <div className="relative"><Gift className={icon} />
              <input className={field} value={data.referralCode} onChange={e => set({ referralCode: e.target.value.toUpperCase() })} placeholder="Ej: ABC123" autoComplete="off" />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} disabled={loading}
            className="h-12 px-4 rounded-xl border border-white/10 text-sm font-semibold text-[#FCFCFD]/80 hover:bg-white/5 flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
        )}
        <button type="submit" disabled={loading}
          className="cg-btn-primary flex-1 h-12 text-sm">
          {loading ? 'Creando cuenta...' : step < REGISTRATION_STEPS.length - 1 ? <>Siguiente <ArrowRight className="w-4 h-4" /></> : <>Crear cuenta gratis <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
      {step === REGISTRATION_STEPS.length - 1 && legalNotice}
    </form>
  )
}

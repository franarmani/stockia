import { supabase } from '@/lib/supabase'
import { isValidCuit, normalizeCuit } from '@/features/purchases/cuit'
import { BUSINESS_TYPES, AR_PROVINCES } from '@/config/businessTypes'

// Alta de cuenta: usuario + negocio con todos los datos que el sistema necesita para operar
// (facturar, aparecer en comprobantes, mostrar la tienda, cobrar con Mercado Pago, etc.).

export const TRIAL_DAYS = 5
export const BUSINESS_IVA_CONDITIONS = [
  { id: 'monotributo', label: 'Monotributista' },
  { id: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { id: 'exento', label: 'Exento' },
] as const

export interface RegistrationData {
  businessName: string
  businessType: string
  businessTypeOther: string
  phone: string
  address: string
  city: string
  province: string
  cuit: string
  razonSocial: string
  ivaCondition: string
  fullName: string
  email: string
  password: string
  referralCode: string
}

export const emptyRegistration: RegistrationData = {
  businessName: '', businessType: '', businessTypeOther: '', phone: '', address: '', city: '', province: 'Buenos Aires',
  cuit: '', razonSocial: '', ivaCondition: 'monotributo', fullName: '', email: '', password: '', referralCode: '',
}

export const REGISTRATION_STEPS = ['Tu negocio', 'Ubicación y datos fiscales', 'Tu cuenta'] as const

/** Valida un paso del registro. Devuelve el primer problema o null si está completo. */
export function validateRegistrationStep(step: number, data: RegistrationData): string | null {
  if (step === 0) {
    if (data.businessName.trim().length < 2) return 'Ingresá el nombre del negocio'
    if (!BUSINESS_TYPES.some((type) => type.id === data.businessType)) return 'Elegí el rubro de tu negocio'
    if (data.businessType === 'otro' && data.businessTypeOther.trim().length < 3) return 'Contanos cuál es tu rubro'
    if (normalizePhone(data.phone).length < 8) return 'Ingresá un teléfono o WhatsApp válido'
  }
  if (step === 1) {
    if (data.address.trim().length < 3) return 'Ingresá la dirección del local'
    if (data.city.trim().length < 2) return 'Ingresá la ciudad o localidad'
    if (!(AR_PROVINCES as readonly string[]).includes(data.province)) return 'Elegí la provincia'
    if (!isValidCuit(data.cuit)) return 'El CUIT no es válido (son 11 números)'
    if (data.razonSocial.trim().length < 2) return 'Ingresá la razón social o el nombre del titular'
    if (!BUSINESS_IVA_CONDITIONS.some((condition) => condition.id === data.ivaCondition)) return 'Elegí la condición frente al IVA'
  }
  if (step === 2) {
    if (data.fullName.trim().length < 2) return 'Ingresá tu nombre'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return 'Ingresá un email válido'
    if (data.password.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres'
  }
  return null
}

export function validateRegistration(data: RegistrationData): { step: number; error: string } | null {
  for (let step = 0; step < REGISTRATION_STEPS.length; step++) {
    const error = validateRegistrationStep(step, data)
    if (error) return { step, error }
  }
  return null
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

/** Datos del negocio tal como se guardan (lo que usan comprobantes, ARCA, tienda, etc.). */
export function businessRecord(data: RegistrationData, trialEndsAt: Date) {
  const address = data.address.trim()
  const city = data.city.trim()
  return {
    name: data.businessName.trim(),
    business_type: data.businessType === 'otro' ? `otro: ${data.businessTypeOther.trim()}` : data.businessType,
    phone: data.phone.trim(),
    address,
    city,
    province: data.province,
    cuit: normalizeCuit(data.cuit),
    razon_social: data.razonSocial.trim(),
    iva_condition: data.ivaCondition,
    domicilio_comercial: `${address}, ${city}, ${data.province}`,
    email: data.email.trim().toLowerCase(),
    subscription_status: 'trial',
    trial_ends_at: trialEndsAt.toISOString(),
  }
}

export async function registerBusiness(data: RegistrationData): Promise<{ userId: string; businessId: string; referralApplied: boolean }> {
  const invalid = validateRegistration(data)
  if (invalid) throw new Error(invalid.error)

  const email = data.email.trim().toLowerCase()
  const { data: auth, error: authError } = await supabase.auth.signUp({ email, password: data.password })
  if (authError || !auth.user) {
    throw new Error(/already|registered/i.test(authError?.message ?? '') ? 'Ya existe una cuenta con ese email. Iniciá sesión.' : authError?.message || 'No se pudo crear la cuenta')
  }

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert(businessRecord(data, trialEnd) as any)
    .select()
    .single()
  if (businessError || !business) throw new Error('No se pudo crear el negocio. Probá de nuevo o escribinos.')

  const { error: profileError } = await supabase.from('users').insert({
    id: auth.user.id,
    business_id: business.id,
    name: data.fullName.trim(),
    email,
    role: 'admin',
  })
  if (profileError) throw new Error('No se pudo crear tu usuario. Probá de nuevo o escribinos.')

  try { localStorage.setItem('cajago_weather_city', `${data.city.trim()}, AR`) } catch {}

  let referralApplied = false
  if (data.referralCode.trim()) {
    const { data: referral } = await supabase.rpc('redeem_referral_code', { p_code: data.referralCode.trim(), p_business_id: business.id })
    referralApplied = !!referral && typeof referral === 'object' && !Array.isArray(referral) && (referral as any).ok === true
  }

  return { userId: auth.user.id, businessId: business.id, referralApplied }
}

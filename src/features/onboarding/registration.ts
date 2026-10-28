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

export const REGISTRATION_STEPS = ['Tu negocio', 'Ubicación y fiscal', 'Tu cuenta'] as const

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

/** ¿Entró con un proveedor externo (Google) y todavía no tiene negocio? Los de email se crean junto con el negocio. */
export function isOAuthUser(user: { app_metadata?: Record<string, any> } | null | undefined): boolean {
  const provider = user?.app_metadata?.provider
  return !!provider && provider !== 'email'
}

/**
 * Alta del negocio para quien entró con Google. El usuario ya existe en Supabase Auth:
 * solo se crean el negocio y el perfil, con el mismo id. Nunca duplica: si la persona ya tiene
 * perfil, o ya existe otra cuenta de CajaGo con ese email, se corta antes de crear nada.
 */
export async function completeOAuthRegistration(data: RegistrationData): Promise<{ businessId: string }> {
  for (let step = 0; step < 2; step++) {
    const error = validateRegistrationStep(step, data)
    if (error) throw new Error(error)
  }
  const fullName = data.fullName.trim()
  if (fullName.length < 2) throw new Error('Ingresá tu nombre')

  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (!user) throw new Error('Tu sesión venció. Volvé a ingresar con Google.')
  const email = (user.email ?? data.email).trim().toLowerCase()

  const { data: hasProfile } = await (supabase as any).rpc('i_have_profile')
  if (hasProfile === true) throw new Error('Esta cuenta ya tiene un negocio. Entrá desde el menú.')
  const { data: otherAccount, error: guardError } = await (supabase as any).rpc('email_has_other_account')
  if (guardError) throw new Error('No pudimos verificar tu cuenta. Probá de nuevo en un momento.')
  if (otherAccount === true) {
    throw new Error('Ya existe una cuenta de CajaGo con este email. Ingresá con tu email y contraseña (o escribinos para vincular Google).')
  }

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert(businessRecord({ ...data, email }, trialEnd) as any)
    .select()
    .single()
  if (businessError || !business) throw new Error('No se pudo crear el negocio. Probá de nuevo o escribinos.')

  const { error: profileError } = await supabase.from('users').insert({
    id: user.id,
    business_id: business.id,
    name: fullName,
    email,
    role: 'admin',
  })
  if (profileError) throw new Error('No se pudo crear tu usuario. Probá de nuevo o escribinos.')

  try { localStorage.setItem('cajago_weather_city', `${data.city.trim()}, AR`) } catch {}
  return { businessId: business.id }
}

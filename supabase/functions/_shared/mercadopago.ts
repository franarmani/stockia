// Lógica de suscripciones Mercado Pago compartida entre funciones (sin APIs de Deno,
// así también se prueba con vitest).

export const MP_API = 'https://api.mercadopago.com'

// Mismos precios que src/config/plans.ts (el servidor es quien cobra).
export const PLAN_PRICES_ARS = { basic: 38000, premium: 70000, vip: 110000 } as const
export type SubscriptionPlan = keyof typeof PLAN_PRICES_ARS
const PLAN_NAMES: Record<SubscriptionPlan, string> = { basic: 'Básico', premium: 'Premium', vip: 'VIP' }

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === 'basic' || value === 'premium' || value === 'vip'
}

/** Cuentas vinculadas (billing_group) se pagan juntas: una mensualidad por negocio. */
export function subscriptionAmount(plan: SubscriptionPlan, linkedBusinesses: number): number {
  return PLAN_PRICES_ARS[plan] * (1 + Math.max(0, linkedBusinesses))
}

export function buildPreapprovalBody(input: {
  businessId: string
  businessName: string
  payerEmail: string
  plan: SubscriptionPlan
  amount: number
  backUrl: string
}) {
  return {
    reason: `CajaGo ${PLAN_NAMES[input.plan]} · ${input.businessName}`.slice(0, 120),
    external_reference: input.businessId,
    payer_email: input.payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: input.amount,
      currency_id: 'ARS',
    },
    back_url: input.backUrl,
    status: 'pending',
  }
}

export interface NotificationTarget {
  topic: string
  id: string
}

/**
 * Mercado Pago avisa con dos formatos: webhooks (`?type=...&data.id=...` + body
 * `{ type, data: { id } }`) y el IPN viejo (`?topic=...&id=...`). Se aceptan ambos.
 */
export function parseNotification(url: URL, body: any): NotificationTarget | null {
  const topic = String(
    body?.type ?? body?.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  )
  const id = String(body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? body?.id ?? '')
  if (!topic || !id) return null
  return { topic, id }
}

export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=')
      return [key, rest.join('=')]
    })
  )
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null
}

/** Texto firmado por Mercado Pago (documentación "Validar origen de la notificación"). */
export function signatureManifest(dataId: string, requestId: string | null, ts: string): string {
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  return `id:${id};${requestId ? `request-id:${requestId};` : ''}ts:${ts};`
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function isValidSignature(input: {
  secret: string
  signatureHeader: string | null
  requestId: string | null
  dataId: string
}): Promise<boolean> {
  const parsed = parseSignatureHeader(input.signatureHeader)
  if (!parsed) return false
  const expected = await hmacSha256Hex(input.secret, signatureManifest(input.dataId, input.requestId, parsed.ts))
  if (expected.length !== parsed.v1.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parsed.v1.charCodeAt(i)
  return diff === 0
}

export interface ApprovedCharge {
  paymentId: string
  amount: number
  paidAt: string
}

/** Un cobro mensual (authorized_payment) cuenta solo si su pago quedó aprobado. */
export function approvedChargeFrom(authorizedPayment: any): ApprovedCharge | null {
  const payment = authorizedPayment?.payment
  if (!payment?.id || payment.status !== 'approved') return null
  return {
    paymentId: String(payment.id),
    amount: Number(authorizedPayment.transaction_amount) || 0,
    paidAt: authorizedPayment.last_modified || authorizedPayment.debit_date || authorizedPayment.date_created || new Date().toISOString(),
  }
}

/** Id de suscripción asociado a un pago (llega por el tópico `payment`). */
export function preapprovalIdFromPayment(payment: any): string | null {
  return payment?.metadata?.preapproval_id
    ?? payment?.point_of_interaction?.transaction_data?.subscription_id
    ?? null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

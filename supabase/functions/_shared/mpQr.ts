// Lógica del cobro con QR de Mercado Pago (sin APIs de Deno: se prueba con vitest).

export const MP_AUTH_URL = 'https://auth.mercadopago.com.ar/authorization'

export const AR_PROVINCES = [
  'Buenos Aires', 'Capital Federal', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta',
  'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
] as const

export function buildAuthorizationUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', platform_id: 'mp', state, redirect_uri: redirectUri })
  return `${MP_AUTH_URL}?${params.toString()}`
}

/** El token dura 180 días; se renueva con tiempo (7 días antes) para no cortar cobros. */
export function needsRefresh(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000
}

/** external_reference de Mercado Pago: hasta 64 caracteres, letras, números, - y _. */
export function toExternalReference(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
}

export function money(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

/** Order de QR dinámico (API de Orders): un QR de un solo uso por cobro, vence en 10 minutos. */
export function buildQrOrderBody(input: { reference: string; amount: number; description: string; posExternalId: string }) {
  const amount = money(input.amount)
  return {
    type: 'qr',
    external_reference: toExternalReference(input.reference),
    description: input.description.slice(0, 150),
    total_amount: amount,
    expiration_time: 'PT10M',
    config: { qr: { external_pos_id: input.posExternalId, mode: 'dynamic' } },
    transactions: { payments: [{ amount }] },
    items: [{ title: input.description.slice(0, 150) || 'Compra', unit_price: amount, quantity: 1, unit_measure: 'unit' }],
  }
}

export type QrOrderState = 'pending' | 'paid' | 'canceled' | 'expired' | 'refunded'

export function qrOrderState(order: { status?: string; status_detail?: string } | null): QrOrderState {
  switch (order?.status) {
    case 'processed': return 'paid'
    case 'canceled': return 'canceled'
    case 'expired': return 'expired'
    case 'refunded': return 'refunded'
    default: return 'pending'
  }
}

/** Ids estables de sucursal y caja en la cuenta del comercio (únicos por negocio). */
export function storeIds(businessId: string) {
  const short = businessId.replace(/-/g, '').slice(0, 16).toUpperCase()
  return { storeExternalId: `CAJAGO${short}`, posExternalId: `CAJAGOPOS${short}` }
}

import { ZAPI_BASE, zapiUrl } from './whatsappBot.ts'

export interface ZapiCredentials {
  instance_id: string | null
  instance_token: string | null
  client_token: string | null
}

export function hasCredentials(c: ZapiCredentials | null): c is { instance_id: string; instance_token: string; client_token: string | null } {
  return !!c?.instance_id && !!c?.instance_token
}

async function zapiFetch(c: ZapiCredentials, path: string, init: RequestInit = {}) {
  if (!hasCredentials(c)) throw new Error('Faltan los datos de la instancia de Z-API')
  const response = await fetch(zapiUrl(c.instance_id, c.instance_token, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Las instancias que crea CajaGo usan el token de seguridad de la cuenta de partner.
      ...((c.client_token || Deno.env.get('ZAPI_CLIENT_TOKEN')) ? { 'Client-Token': c.client_token || Deno.env.get('ZAPI_CLIENT_TOKEN')! } : {}),
      ...(init.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Z-API: ${data?.error || data?.message || `HTTP ${response.status}`}`)
  return data
}

export function sendText(c: ZapiCredentials, phone: string, message: string) {
  return zapiFetch(c, 'send-text', { method: 'POST', body: JSON.stringify({ phone, message }) })
}

export function instanceStatus(c: ZapiCredentials) {
  return zapiFetch(c, 'status') as Promise<{ connected?: boolean; smartphoneConnected?: boolean; error?: string }>
}

/** Apunta el webhook de mensajes recibidos de la instancia a CajaGo. */
export function setReceivedWebhook(c: ZapiCredentials, url: string) {
  return zapiFetch(c, 'update-webhook-received', { method: 'PUT', body: JSON.stringify({ value: url }) })
}

export function qrCodeImage(c: ZapiCredentials) {
  return zapiFetch(c, 'qr-code/image') as Promise<{ value?: string; connected?: boolean }>
}

export function disconnectInstance(c: ZapiCredentials) {
  return zapiFetch(c, 'disconnect')
}

// ── Cuenta de partner (integrador) de CajaGo: crea y factura una instancia por negocio ──

async function partnerFetch(path: string, body: unknown) {
  const partnerToken = Deno.env.get('ZAPI_PARTNER_TOKEN')
  if (!partnerToken) throw new Error('WhatsApp todavía no está habilitado en CajaGo (falta la cuenta de partner de Z-API)')
  const response = await fetch(`${ZAPI_BASE}/instances${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partnerToken}` },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Z-API: ${data?.error || data?.message || `HTTP ${response.status}`}`)
  return data
}

/** Instancia nueva para un negocio, con los avisos de mensajes recibidos apuntando a CajaGo. */
export async function createManagedInstance(name: string, receivedCallbackUrl: string): Promise<{ id: string; token: string }> {
  const data = await partnerFetch('/integrator/on-demand', { name: name.slice(0, 60), receivedCallbackUrl, isDevice: false, businessDevice: true })
  if (!data?.id || !data?.token) throw new Error('Z-API no devolvió la instancia creada')
  return { id: String(data.id), token: String(data.token) }
}

/** Se suscribe (empieza a facturarse) recién cuando el comercio conectó su número. */
export function subscribeManagedInstance(id: string, token: string) {
  return partnerFetch(`/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}/integrator/on-demand/subscription`, {})
}

export function cancelManagedInstance(id: string, token: string) {
  return partnerFetch(`/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}/integrator/on-demand/cancel`, {})
}

import { zapiUrl } from './whatsappBot.ts'

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
      ...(c.client_token ? { 'Client-Token': c.client_token } : {}),
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

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { needsRefresh } from './mpQr.ts'

export const MP_API = 'https://api.mercadopago.com'
export const DEFAULT_CLIENT_ID = '1843555770409913'

export function oauthRedirectUri(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`
}

/** Llamada a Mercado Pago con el token del comercio (no el de CajaGo). */
export async function sellerFetch(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.message || data?.errors?.[0]?.message || data?.error || `HTTP ${response.status}`
    const error = new Error(`Mercado Pago: ${message}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return data
}

export async function exchangeToken(body: Record<string, string>) {
  const clientSecret = Deno.env.get('MP_CLIENT_SECRET')
  if (!clientSecret) throw new Error('Falta configurar MP_CLIENT_SECRET en Supabase')
  const response = await fetch(`${MP_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: Deno.env.get('MP_CLIENT_ID') || DEFAULT_CLIENT_ID, client_secret: clientSecret, ...body }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) throw new Error(`Mercado Pago no autorizó la conexión: ${data?.message || data?.error || response.status}`)
  return data as { access_token: string; refresh_token?: string; user_id: number; expires_in: number }
}

/** Conexión del negocio con el token vigente (lo renueva si está por vencer). */
export async function getConnection(admin: SupabaseClient, businessId: string) {
  const { data: connection } = await admin.from('mp_connections').select('*').eq('business_id', businessId).maybeSingle()
  if (!connection) return null
  if (connection.refresh_token && needsRefresh(connection.expires_at)) {
    try {
      const token = await exchangeToken({ grant_type: 'refresh_token', refresh_token: connection.refresh_token })
      const updated = {
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? connection.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }
      await admin.from('mp_connections').update(updated).eq('business_id', businessId)
      return { ...connection, ...updated }
    } catch (error) {
      console.warn('[mp-seller] no se pudo renovar el token:', error)
    }
  }
  return connection
}

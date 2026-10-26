// Vuelta de Mercado Pago después de que el comercio autoriza a CajaGo (OAuth). Público.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { exchangeToken, oauthRedirectUri, sellerFetch } from '../_shared/mpSeller.ts'

const STATE_TTL_MS = 15 * 60 * 1000

Deno.serve(async request => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return page('No se pudo conectar', 'Faltan datos de Mercado Pago. Volvé a intentarlo desde CajaGo.', false)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const { data: pending } = await admin.from('mp_oauth_states').select('*').eq('state', state).maybeSingle()
    // Un solo uso: se borra aunque esté vencido.
    if (pending) await admin.from('mp_oauth_states').delete().eq('state', state)
    if (!pending || Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS) {
      return page('El link venció', 'Volvé a tocar "Conectar Mercado Pago" en CajaGo.', false)
    }

    const token = await exchangeToken({ grant_type: 'authorization_code', code, redirect_uri: oauthRedirectUri() })
    const me = await sellerFetch(token.access_token, '/users/me').catch(() => null)

    const { error } = await admin.from('mp_connections').upsert({
      business_id: pending.business_id,
      mp_user_id: String(token.user_id),
      nickname: me?.nickname ?? me?.email ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      // Una cuenta nueva necesita su propia sucursal y caja.
      store_id: null,
      pos_external_id: null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)

    return page('¡Mercado Pago conectado!', `Cuenta ${me?.nickname ?? ''} vinculada. Ya podés cerrar esta pestaña y volver a CajaGo.`, true)
  } catch (error) {
    console.error('[mp-oauth-callback]', error)
    return page('No se pudo conectar', error instanceof Error ? error.message : 'Error inesperado', false)
  }
})

// Supabase sirve las funciones como texto plano (no HTML), así que la respuesta es un mensaje simple.
function page(title: string, message: string, ok: boolean) {
  const text = `${ok ? '✔' : '✖'} ${title}

${message}

CajaGo`
  return new Response(text, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

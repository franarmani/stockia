// Vuelta de la autorización de Tiendanube: guarda el token de la tienda y registra los webhooks.
// Responde texto plano porque Supabase no sirve HTML desde las funciones.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TN_AUTH, tnFetch } from '../_shared/tiendanube.ts'

const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/tiendanube-webhook`
const EVENTS = ['order/paid', 'order/cancelled', 'app/uninstalled']

Deno.serve(async request => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return text('Falta información de Tiendanube. Volvé a CajaGo y tocá "Conectar" de nuevo.', 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const { data: pending } = await admin.from('tiendanube_oauth_states').select('*').eq('state', state).maybeSingle()
    if (!pending) return text('El link de conexión ya se usó o no es válido. Volvé a CajaGo y tocá "Conectar" de nuevo.', 400)
    await admin.from('tiendanube_oauth_states').delete().eq('state', state)
    if (Date.now() - new Date(pending.created_at).getTime() > 15 * 60 * 1000) {
      return text('El link de conexión venció. Volvé a CajaGo y tocá "Conectar" de nuevo.', 400)
    }

    const tokenResponse = await fetch(`${TN_AUTH}/authorize/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('TIENDANUBE_APP_ID'),
        client_secret: Deno.env.get('TIENDANUBE_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        code,
      }),
    })
    const token = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || !token?.access_token || !token?.user_id) {
      console.error('[tiendanube-oauth] token', tokenResponse.status, token)
      return text('Tiendanube no autorizó la conexión. Probá de nuevo desde CajaGo.', 502)
    }
    const storeId = Number(token.user_id)

    const { data: other } = await admin.from('tiendanube_connections').select('business_id').eq('store_id', storeId).maybeSingle()
    if (other && other.business_id !== pending.business_id) {
      return text('Esa tienda de Tiendanube ya está conectada a otro negocio de CajaGo.', 409)
    }

    let storeName: string | null = null
    const storeResponse = await tnFetch(storeId, token.access_token, '/store')
    if (storeResponse.ok) {
      const store = await storeResponse.json()
      storeName = typeof store?.name === 'string' ? store.name : store?.name?.es ?? Object.values(store?.name ?? {})[0] as string ?? null
    }

    const { error } = await admin.from('tiendanube_connections').upsert({
      business_id: pending.business_id,
      store_id: storeId,
      access_token: token.access_token,
      scope: token.scope ?? null,
      store_name: storeName,
      connected_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'business_id' })
    if (error) throw new Error(error.message)

    // Webhooks de esta tienda hacia CajaGo (sin duplicar si ya existían).
    const existing = await tnFetch(storeId, token.access_token, '/webhooks')
    const hooks: any[] = existing.ok ? await existing.json() : []
    for (const event of EVENTS) {
      if (hooks.some(hook => hook.event === event && hook.url === WEBHOOK_URL)) continue
      const created = await tnFetch(storeId, token.access_token, '/webhooks', { method: 'POST', body: JSON.stringify({ event, url: WEBHOOK_URL }) })
      if (!created.ok) console.error('[tiendanube-oauth] webhook', event, created.status, await created.text())
    }

    return text(`Listo: ${storeName ?? 'tu tienda'} quedó conectada a CajaGo.\n\nVolvé al programa, entrá a Tiendanube y tocá "Sincronizar productos".`)
  } catch (error) {
    console.error('[tiendanube-oauth]', error)
    return text('No se pudo terminar la conexión. Probá de nuevo desde CajaGo.', 500)
  }
})

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

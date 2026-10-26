// Cobro con QR de Mercado Pago en el POS, con la cuenta del comercio (conectada por OAuth).
// Acciones: connect_url, status, setup_pos, disconnect, create, check, cancel.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, INACTIVE_MESSAGE } from '../_shared/access.ts'
import { AR_PROVINCES, buildAuthorizationUrl, buildQrOrderBody, qrOrderState, storeIds } from '../_shared/mpQr.ts'
import { DEFAULT_CLIENT_ID, getConnection, oauthRedirectUri, sellerFetch } from '../_shared/mpSeller.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
}

/** Coordenadas aproximadas de la ciudad (Mercado Pago las pide para la sucursal). */
async function geocodeCity(city: string, province: string): Promise<{ latitude: number; longitude: number }> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=es&countryCode=AR`
    const data = await (await fetch(url)).json()
    const match = data?.results?.find((r: any) => String(r.admin1 ?? '').toLowerCase().includes(province.toLowerCase().split(' ')[0])) ?? data?.results?.[0]
    if (match) return { latitude: match.latitude, longitude: match.longitude }
  } catch (error) {
    console.warn('[mp-qr] geocoding falló:', error)
  }
  return { latitude: -34.6037, longitude: -58.3816 }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'No autorizado' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await admin.from('users').select('business_id, role').eq('id', user.id).maybeSingle()
    if (!profile?.business_id) return json({ error: 'Usuario sin negocio' }, 403)
    const businessId = profile.business_id as string
    if (!(await businessIsActive(admin, businessId))) return json({ error: INACTIVE_MESSAGE }, 403)
    const isAdmin = profile.role === 'admin'

    const { data: business } = await admin.from('businesses').select('name, plan, subscription_status').eq('id', businessId).single()
    if (!business || (business.plan === 'basic' && business.subscription_status !== 'trial')) {
      return json({ error: 'El cobro con QR de Mercado Pago es parte del plan Premium' }, 403)
    }

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (action === 'connect_url') {
      if (!isAdmin) return json({ error: 'Solo un administrador puede conectar Mercado Pago' }, 403)
      const state = randomState()
      await admin.from('mp_oauth_states').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      const { error } = await admin.from('mp_oauth_states').insert({ state, business_id: businessId, user_id: user.id })
      if (error) throw new Error(error.message)
      return json({ url: buildAuthorizationUrl(Deno.env.get('MP_CLIENT_ID') || DEFAULT_CLIENT_ID, state, oauthRedirectUri()) })
    }

    if (action === 'status') {
      const { data: connection } = await admin.from('mp_connections').select('nickname, pos_external_id, expires_at').eq('business_id', businessId).maybeSingle()
      return json({
        connected: !!connection,
        nickname: connection?.nickname ?? null,
        pos_ready: !!connection?.pos_external_id,
        expires_at: connection?.expires_at ?? null,
      })
    }

    if (action === 'disconnect') {
      if (!isAdmin) return json({ error: 'Solo un administrador puede desconectar Mercado Pago' }, 403)
      await admin.from('mp_connections').delete().eq('business_id', businessId)
      return json({ connected: false })
    }

    const connection = await getConnection(admin, businessId)
    if (!connection) return json({ error: 'Conectá tu cuenta de Mercado Pago en Configuración → Medios de pago' }, 409)
    const token = connection.access_token as string

    if (action === 'setup_pos') {
      if (!isAdmin) return json({ error: 'Solo un administrador puede configurar la caja' }, 403)
      const streetName = String(body?.street_name ?? '').trim()
      const streetNumber = String(body?.street_number ?? '').trim()
      const city = String(body?.city ?? '').trim()
      const province = String(body?.state_name ?? '')
      if (!streetName || !streetNumber || !city) return json({ error: 'Completá calle, número y ciudad del local' }, 400)
      if (!(AR_PROVINCES as readonly string[]).includes(province)) return json({ error: 'Elegí una provincia válida' }, 400)

      const { storeExternalId, posExternalId } = storeIds(businessId)
      let storeId = connection.store_id as string | null
      if (!storeId) {
        const coords = await geocodeCity(city, province)
        const store = await sellerFetch(token, `/users/${connection.mp_user_id}/stores`, {
          method: 'POST',
          body: JSON.stringify({
            name: String(business.name).slice(0, 60),
            external_id: storeExternalId,
            location: { street_number: streetNumber, street_name: streetName, city_name: city, state_name: province, ...coords, reference: 'CajaGo' },
          }),
        })
        storeId = String(store.id)
        await admin.from('mp_connections').update({ store_id: storeId }).eq('business_id', businessId)
      }

      await sellerFetch(token, '/v2/pos', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': `${posExternalId}-${storeId}` },
        body: JSON.stringify({ name: 'CajaGo', store_id: storeId, external_id: posExternalId, config: { qr: { operating_mode: 'pdv' } } }),
      }).catch(error => {
        // La caja ya existía (por ejemplo, un reintento): se sigue usando la misma.
        if (!/already|exist|duplicad/i.test(String(error?.message))) throw error
      })
      await admin.from('mp_connections').update({ pos_external_id: posExternalId, updated_at: new Date().toISOString() }).eq('business_id', businessId)
      return json({ pos_ready: true })
    }

    if (!connection.pos_external_id) return json({ error: 'Falta configurar la caja de Mercado Pago en Configuración → Medios de pago' }, 409)

    if (action === 'create') {
      const amount = Number(body?.amount)
      const reference = String(body?.reference ?? '')
      if (!(amount > 0) || amount > 50_000_000) return json({ error: 'Monto inválido' }, 400)
      if (!reference) return json({ error: 'Falta la referencia del cobro' }, 400)
      const order = await sellerFetch(token, '/v1/orders', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': `cajago-${reference}`.slice(0, 64) },
        body: JSON.stringify(buildQrOrderBody({
          reference,
          amount,
          description: String(body?.description || `Compra en ${business.name}`),
          posExternalId: connection.pos_external_id,
        })),
      })
      return json({ order_id: order.id, qr_data: order.type_response?.qr_data, state: qrOrderState(order) })
    }

    if (action === 'check' || action === 'cancel') {
      const orderId = String(body?.order_id ?? '')
      if (!/^[A-Za-z0-9_-]{4,64}$/.test(orderId)) return json({ error: 'Orden inválida' }, 400)
      if (action === 'cancel') {
        const canceled = await sellerFetch(token, `/v1/orders/${orderId}/cancel`, {
          method: 'POST',
          headers: { 'X-Idempotency-Key': `cancel-${orderId}` },
        }).catch(error => (error?.status === 409 ? null : Promise.reject(error)))
        if (canceled) return json({ state: qrOrderState(canceled) })
      }
      const order = await sellerFetch(token, `/v1/orders/${orderId}`)
      return json({ state: qrOrderState(order), payment_id: order?.transactions?.payments?.[0]?.id ?? null })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[mp-qr]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

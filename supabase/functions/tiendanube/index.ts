// Tiendanube desde el programa (plan VIP). Acciones: status, connect_url, sync, link, disconnect.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess, INACTIVE_MESSAGE } from '../_shared/access.ts'
import { flattenVariants, matchVariants, TN_AUTH, tnFetch } from '../_shared/tiendanube.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
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
    const { data: business } = await admin.from('businesses').select('plan, subscription_status').eq('id', businessId).single()
    if (!hasVipAccess(business)) return json({ error: 'La conexión con Tiendanube es parte del plan VIP' }, 403)

    const body = await request.json().catch(() => ({}))
    const action = body?.action
    const isAdmin = profile.role === 'admin'
    const { data: connection } = await admin.from('tiendanube_connections').select('*').eq('business_id', businessId).maybeSingle()

    if (action === 'status') {
      const [{ count: linked }, { count: pending }, { data: orders }] = await Promise.all([
        admin.from('tiendanube_product_links').select('product_id', { count: 'exact', head: true }).eq('business_id', businessId),
        admin.from('tiendanube_stock_queue').select('product_id', { count: 'exact', head: true }).eq('business_id', businessId),
        admin.from('tiendanube_orders').select('tn_order_id, order_number, customer_name, total, created_at, items').eq('business_id', businessId).order('created_at', { ascending: false }).limit(15),
      ])
      return json({
        connected: !!connection,
        store_name: connection?.store_name ?? null,
        store_id: connection?.store_id ?? null,
        connected_at: connection?.connected_at ?? null,
        last_sync_at: connection?.last_sync_at ?? null,
        last_error: connection?.last_error ?? null,
        linked: linked ?? 0,
        pending_stock: pending ?? 0,
        orders: orders ?? [],
      })
    }

    if (!isAdmin) return json({ error: 'Solo un administrador puede configurar Tiendanube' }, 403)

    if (action === 'connect_url') {
      const state = randomState()
      const { error } = await admin.from('tiendanube_oauth_states').insert({ state, business_id: businessId, user_id: user.id })
      if (error) throw new Error(error.message)
      return json({ url: `${TN_AUTH}/${Deno.env.get('TIENDANUBE_APP_ID')}/authorize?state=${state}` })
    }

    if (!connection) return json({ error: 'Primero conectá tu tienda de Tiendanube' }, 400)

    if (action === 'sync') {
      // Todas las variantes de Tiendanube (de a 200) contra los productos activos de CajaGo.
      const tnProducts: any[] = []
      for (let page = 1; page <= 100; page++) {
        const response = await tnFetch(connection.store_id, connection.access_token, `/products?per_page=200&page=${page}`)
        if (response.status === 404) break
        if (!response.ok) throw new Error(`Tiendanube respondió ${response.status} al leer los productos`)
        const batch = await response.json()
        tnProducts.push(...batch)
        if (batch.length < 200) break
      }
      const local: Array<{ id: string; barcode: string | null }> = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from('products').select('id, barcode').eq('business_id', businessId).eq('active', true).range(from, from + 999)
        if (error) throw new Error(error.message)
        local.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }

      const variants = flattenVariants(tnProducts)
      const { links, unmatched } = matchVariants(variants, local)
      const { data: manual } = await admin.from('tiendanube_product_links').select('tn_variant_id').eq('business_id', businessId).eq('linked_by', 'manual')
      const manualIds = new Set((manual ?? []).map(row => Number(row.tn_variant_id)))
      const automatic = links.filter(link => !manualIds.has(link.tn_variant_id))

      for (let i = 0; i < automatic.length; i += 500) {
        const { error } = await admin.from('tiendanube_product_links').upsert(
          automatic.slice(i, i + 500).map(link => ({ ...link, business_id: businessId, linked_by: 'sku' })),
          { onConflict: 'business_id,tn_variant_id' })
        if (error) throw new Error(error.message)
      }
      // Lo vinculado arranca con el stock de CajaGo.
      const { data: allLinks } = await admin.from('tiendanube_product_links').select('product_id').eq('business_id', businessId)
      const productIds = [...new Set((allLinks ?? []).map(row => row.product_id))]
      for (let i = 0; i < productIds.length; i += 500) {
        await admin.from('tiendanube_stock_queue').upsert(
          productIds.slice(i, i + 500).map(product_id => ({ product_id, business_id: businessId, queued_at: new Date().toISOString() })),
          { onConflict: 'product_id' })
      }
      await admin.from('tiendanube_connections').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('business_id', businessId)

      const linkedVariants = new Set((await admin.from('tiendanube_product_links').select('tn_variant_id').eq('business_id', businessId)).data?.map(row => Number(row.tn_variant_id)) ?? [])
      const stillUnmatched = unmatched.filter(variant => !linkedVariants.has(variant.tn_variant_id))
      return json({ variants: variants.length, linked: linkedVariants.size, unmatched: stillUnmatched.slice(0, 300), unmatched_total: stillUnmatched.length })
    }

    if (action === 'link') {
      const tnProductId = Number(body?.tn_product_id)
      const tnVariantId = Number(body?.tn_variant_id)
      const { data: product } = await admin.from('products').select('id').eq('id', body?.product_id).eq('business_id', businessId).maybeSingle()
      if (!product || !tnProductId || !tnVariantId) return json({ error: 'Producto inválido' }, 400)
      const { error } = await admin.from('tiendanube_product_links').upsert(
        { business_id: businessId, product_id: product.id, tn_product_id: tnProductId, tn_variant_id: tnVariantId, linked_by: 'manual' },
        { onConflict: 'business_id,tn_variant_id' })
      if (error) throw new Error(error.message)
      await admin.from('tiendanube_stock_queue').upsert({ product_id: product.id, business_id: businessId, queued_at: new Date().toISOString() }, { onConflict: 'product_id' })
      return json({ ok: true })
    }

    if (action === 'disconnect') {
      // Se borran los webhooks de la tienda para que no siga mandando avisos.
      try {
        const response = await tnFetch(connection.store_id, connection.access_token, '/webhooks')
        if (response.ok) {
          for (const hook of await response.json()) {
            if (String(hook.url ?? '').includes('/functions/v1/tiendanube-webhook')) {
              await tnFetch(connection.store_id, connection.access_token, `/webhooks/${hook.id}`, { method: 'DELETE' })
            }
          }
        }
      } catch (error) {
        console.warn('[tiendanube] no se pudieron borrar los webhooks:', error)
      }
      await admin.from('tiendanube_stock_queue').delete().eq('business_id', businessId)
      await admin.from('tiendanube_product_links').delete().eq('business_id', businessId)
      await admin.from('tiendanube_connections').delete().eq('business_id', businessId)
      return json({ ok: true })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[tiendanube]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

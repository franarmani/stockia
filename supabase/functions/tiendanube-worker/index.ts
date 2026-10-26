// Manda a Tiendanube el stock que cambió en CajaGo. Lo despierta pg_cron cada minuto si hay cola
// (tiendanube_stock_queue), con un secreto compartido. Respeta el límite de la API (2 pedidos/s).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess } from '../_shared/access.ts'
import { tnFetch } from '../_shared/tiendanube.ts'

const PER_STORE_PER_RUN = 80

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

Deno.serve(async request => {
  const secret = Deno.env.get('TIENDANUBE_CRON_SECRET')
  if (!secret || request.headers.get('x-cajago-cron') !== secret) return new Response('no autorizado', { status: 401 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: queue } = await admin.from('tiendanube_stock_queue').select('product_id, business_id, queued_at').order('queued_at').limit(1000)
  const byBusiness = new Map<string, Array<{ product_id: string; queued_at: string }>>()
  for (const row of queue ?? []) {
    const list = byBusiness.get(row.business_id) ?? []
    if (list.length < PER_STORE_PER_RUN) list.push(row)
    byBusiness.set(row.business_id, list)
  }

  let sent = 0
  for (const [businessId, rows] of byBusiness) {
    const { data: connection } = await admin.from('tiendanube_connections').select('store_id, access_token').eq('business_id', businessId).maybeSingle()
    const { data: business } = await admin.from('businesses').select('plan, subscription_status').eq('id', businessId).maybeSingle()
    if (!connection || !hasVipAccess(business) || !(await businessIsActive(admin, businessId))) {
      await admin.from('tiendanube_stock_queue').delete().eq('business_id', businessId)
      continue
    }

    const ids = rows.map(row => row.product_id)
    const [{ data: products }, { data: links }] = await Promise.all([
      admin.from('products').select('id, stock').in('id', ids),
      admin.from('tiendanube_product_links').select('product_id, tn_product_id, tn_variant_id').eq('business_id', businessId).in('product_id', ids),
    ])
    const stockById = new Map((products ?? []).map(product => [product.id, Math.max(0, Math.floor(Number(product.stock) || 0))]))

    let lastError: string | null = null
    for (const row of rows) {
      let ok = true
      for (const link of (links ?? []).filter(l => l.product_id === row.product_id)) {
        const response = await tnFetch(connection.store_id, connection.access_token, `/products/${link.tn_product_id}/variants/stock`, {
          method: 'POST',
          body: JSON.stringify({ action: 'replace', value: stockById.get(row.product_id) ?? 0, id: Number(link.tn_variant_id) }),
        })
        sent++
        if (response.status === 429) { ok = false; lastError = 'Tiendanube pidió esperar (límite de pedidos)'; break }
        if (response.status === 404) {
          // La variante ya no existe en Tiendanube.
          await admin.from('tiendanube_product_links').delete().eq('business_id', businessId).eq('tn_variant_id', link.tn_variant_id)
        } else if (!response.ok) {
          ok = false
          lastError = `Tiendanube respondió ${response.status} al actualizar stock`
        }
        if (sent > 30) await sleep(450)
      }
      if (lastError?.startsWith('Tiendanube pidió esperar')) break
      // Solo se saca de la cola si no volvió a cambiar mientras tanto.
      if (ok) await admin.from('tiendanube_stock_queue').delete().eq('product_id', row.product_id).lte('queued_at', row.queued_at)
    }
    await admin.from('tiendanube_connections').update({ last_sync_at: new Date().toISOString(), last_error: lastError }).eq('business_id', businessId)
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})

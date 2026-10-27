// Avisos de Tiendanube: ventas pagadas, pedidos cancelados, desinstalación y los pedidos de privacidad obligatorios.
// Tiendanube puede repetir avisos: tiendanube_record_order no registra dos veces el mismo pedido.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess } from '../_shared/access.ts'
import { orderLines, tnFetch, verifyTiendanubeHmac } from '../_shared/tiendanube.ts'

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('ignored')
  const raw = await request.text()
  const valid = await verifyTiendanubeHmac(raw, request.headers.get('x-linkedstore-hmac-sha256'), Deno.env.get('TIENDANUBE_CLIENT_SECRET') ?? '')
  if (!valid) return new Response('firma inválida', { status: 401 })

  const payload = JSON.parse(raw)
  const event = String(payload?.event ?? '')
  const storeId = Number(payload?.store_id)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const { data: connection } = await admin.from('tiendanube_connections').select('*').eq('store_id', storeId).maybeSingle()
    if (!connection) return new Response('ok')
    const businessId = connection.business_id as string

    if (event === 'app/uninstalled' || event === 'store/redact') {
      await admin.from('tiendanube_stock_queue').delete().eq('business_id', businessId)
      await admin.from('tiendanube_product_links').delete().eq('business_id', businessId)
      await admin.from('tiendanube_connections').delete().eq('business_id', businessId)
      return new Response('ok')
    }

    if (event === 'customers/redact') {
      const orderIds = (payload?.orders_to_redact ?? []).map(Number).filter(Boolean)
      if (orderIds.length) await admin.from('tiendanube_orders').update({ customer_name: null }).eq('business_id', businessId).in('tn_order_id', orderIds)
      return new Response('ok')
    }

    if (event === 'order/cancelled') {
      // Anula la venta y devuelve el stock (solo si el pedido había entrado como pagado).
      const { error } = await admin.rpc('tiendanube_cancel_order', { p_business_id: businessId, p_tn_order_id: Number(payload.id) })
      if (error) throw new Error(error.message)
      return new Response('ok')
    }

    if (event !== 'order/paid') return new Response('ok')

    const { data: business } = await admin.from('businesses').select('plan, subscription_status').eq('id', businessId).single()
    if (!hasVipAccess(business) || !(await businessIsActive(admin, businessId))) return new Response('ok')

    const response = await tnFetch(storeId, connection.access_token, `/orders/${Number(payload.id)}`)
    if (!response.ok) throw new Error(`Tiendanube respondió ${response.status} al leer el pedido ${payload.id}`)
    const order = await response.json()

    const { data: links } = await admin.from('tiendanube_product_links').select('tn_variant_id, product_id').eq('business_id', businessId)
    const byVariant = new Map((links ?? []).map(link => [Number(link.tn_variant_id), link.product_id as string]))
    const customer = order?.customer?.name ?? order?.contact_name ?? null

    const { error } = await admin.rpc('tiendanube_record_order', {
      p_business_id: businessId,
      p_tn_order_id: Number(order.id),
      p_number: order.number != null ? String(order.number) : null,
      p_customer: customer,
      p_total: Number(order.total) || 0,
      p_lines: orderLines(order, byVariant),
    })
    if (error) throw new Error(error.message)
    return new Response('ok')
  } catch (error) {
    console.error('[tiendanube-webhook]', event, error)
    await admin.from('tiendanube_connections').update({ last_error: String(error instanceof Error ? error.message : error).slice(0, 300) }).eq('store_id', storeId)
    // 500 para que Tiendanube reintente; el registro es idempotente.
    return new Response('error', { status: 500 })
  }
})

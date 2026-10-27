// Tienda online pública: catálogo y pedidos. Sin login (verify_jwt = false).
// Usa service role pero solo expone negocios con la tienda activa y plan que la incluye.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess } from '../_shared/access.ts'
import { isValidSlug, orderMessage, validateOrder, whatsappOrderLink } from '../_shared/onlineStore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const body = await request.json().catch(() => null)
    if (!body || !isValidSlug(body.slug)) return json({ error: 'Tienda no encontrada' }, 404)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: business } = await admin.from('businesses')
      .select('id, name, logo_url, address, city, phone, plan, subscription_status, trial_ends_at, store_enabled, store_whatsapp, store_message, store_cover_url, primary_color, tiendanube_connected')
      .eq('store_slug', body.slug)
      .maybeSingle()

    // La tienda es parte de Premium (o de la prueba) y requiere la suscripción al día.
    const premium = hasVipAccess(business)
    const current = business && await businessIsActive(admin, business.id)
    if (!business || !business.store_enabled || business.tiendanube_connected || !premium || !current) return json({ error: 'Tienda no encontrada' }, 404)

    if (body.action === 'catalog') {
      const [{ data: products }, { data: categories }] = await Promise.all([
        admin.from('products')
          .select('id, name, sale_price, stock, unit, image_url, category_id, brand, store_featured')
          .eq('business_id', business.id).eq('active', true).eq('show_online', true).gt('sale_price', 0)
          .order('name').limit(3000),
        admin.from('categories').select('id, name').eq('business_id', business.id).order('name'),
      ])
      return json({
        store: {
          name: business.name,
          logo_url: business.logo_url,
          address: [business.address, business.city].filter(Boolean).join(', ') || null,
          message: business.store_message,
          cover_url: business.store_cover_url,
          color: business.primary_color,
          has_whatsapp: !!whatsappOrderLink(business.store_whatsapp, 'x'),
        },
        categories: categories ?? [],
        products: (products ?? []).map(product => ({
          id: product.id,
          name: product.name,
          price: Number(product.sale_price),
          unit: product.unit,
          image_url: product.image_url,
          category_id: product.category_id,
          brand: product.brand,
          in_stock: Number(product.stock) > 0,
          featured: product.store_featured === true,
        })),
      })
    }

    if (body.action === 'order') {
      const ids = Array.isArray(body.items) ? body.items.slice(0, 100).map((item: any) => String(item?.product_id)) : []
      const { data: products } = await admin.from('products')
        .select('id, name, sale_price, stock, active, show_online')
        .eq('business_id', business.id)
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      const order = validateOrder(body, (products ?? []) as any)
      if (!order.ok) return json({ error: order.error }, 400)

      const { data: saved, error } = await admin.from('online_orders').insert({
        business_id: business.id,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        notes: order.notes,
        delivery_method: order.deliveryMethod,
        delivery_address: order.deliveryAddress,
        items: order.lines,
        total: order.total,
      }).select('id, order_number').single()
      if (error || !saved) throw new Error(error?.message || 'No se pudo guardar el pedido')

      const message = orderMessage({ businessName: business.name, orderNumber: saved.order_number, ...order })
      return json({ order_number: saved.order_number, total: order.total, whatsapp_url: whatsappOrderLink(business.store_whatsapp, message) })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[online-store]', error)
    return json({ error: 'Error inesperado, probá de nuevo en un momento' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Validación de pedidos de la tienda online (sin APIs de Deno: se prueba con vitest).
// Los precios siempre salen de la base, nunca de lo que manda el navegador.

export const STORE_LIMITS = { maxLines: 60, maxQuantity: 999, name: 80, phone: 30, notes: 500 } as const

export interface StoreProductRow {
  id: string
  name: string
  sale_price: number
  stock: number
  active: boolean
  show_online: boolean
}

export interface OrderLine {
  product_id: string
  name: string
  quantity: number
  price: number
}

export type OrderValidation =
  | { ok: true; customerName: string; customerPhone: string; notes: string | null; lines: OrderLine[]; total: number }
  | { ok: false; error: string }

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^[a-z0-9-]{3,40}$/.test(slug)
}

export function validateOrder(input: any, products: StoreProductRow[]): OrderValidation {
  const customerName = String(input?.customer_name ?? '').trim()
  const customerPhone = String(input?.customer_phone ?? '').trim()
  const notes = String(input?.notes ?? '').trim()
  if (customerName.length < 2 || customerName.length > STORE_LIMITS.name) return { ok: false, error: 'Ingresá tu nombre' }
  if (!/^[\d\s+()-]{6,30}$/.test(customerPhone)) return { ok: false, error: 'Ingresá un teléfono válido' }
  if (notes.length > STORE_LIMITS.notes) return { ok: false, error: 'La nota es demasiado larga' }

  const requested = Array.isArray(input?.items) ? input.items : []
  if (requested.length === 0) return { ok: false, error: 'El pedido está vacío' }
  if (requested.length > STORE_LIMITS.maxLines) return { ok: false, error: 'El pedido tiene demasiados productos' }

  const byId = new Map(products.map((product) => [product.id, product]))
  const lines: OrderLine[] = []
  for (const item of requested) {
    const product = byId.get(String(item?.product_id))
    const quantity = Number(item?.quantity)
    if (!product || !product.active || !product.show_online) return { ok: false, error: 'Un producto del pedido ya no está disponible' }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > STORE_LIMITS.maxQuantity) return { ok: false, error: `Cantidad inválida para ${product.name}` }
    lines.push({ product_id: product.id, name: product.name, quantity: Math.round(quantity * 1000) / 1000, price: Number(product.sale_price) || 0 })
  }

  const total = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.price, 0) * 100) / 100
  return { ok: true, customerName, customerPhone, notes: notes || null, lines, total }
}

export function whatsappOrderLink(phone: string | null | undefined, text: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function orderMessage(input: { businessName: string; orderNumber: number; customerName: string; customerPhone: string; notes: string | null; lines: OrderLine[]; total: number }): string {
  const money = (value: number) => '$' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return [
    `Hola ${input.businessName}! Te hago el pedido #${input.orderNumber} desde la tienda online:`,
    '',
    ...input.lines.map((line) => `• ${line.quantity} × ${line.name} — ${money(line.quantity * line.price)}`),
    '',
    `Total: ${money(input.total)}`,
    `Nombre: ${input.customerName}`,
    `Teléfono: ${input.customerPhone}`,
    ...(input.notes ? [`Nota: ${input.notes}`] : []),
  ].join('\n')
}

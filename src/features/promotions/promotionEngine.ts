import type { CartItem } from '@/types/database'

// Promociones del punto de venta. El descuento se expresa en los renglones de la venta
// (unidades bonificadas a $0, o precio unitario rebajado), así ticket, factura ARCA, total
// y caja usan exactamente los mismos números, sin centavos de diferencia.

export type PromotionKind = 'nxm' | 'percent' | 'second_unit' | 'min_total'

export interface Promotion {
  id: string
  business_id?: string
  name: string
  kind: PromotionKind
  /** Productos alcanzados; si está vacío y no hay categoría, aplica a todo el catálogo. */
  product_ids: string[] | null
  category_id: string | null
  /** 'nxm': llevás buy_qty y pagás pay_qty (2x1, 3x2). */
  buy_qty: number | null
  pay_qty: number | null
  /** 'percent' y 'min_total': % de descuento. 'second_unit': % de descuento en la segunda unidad. */
  percent: number | null
  /** 'min_total': la compra (a precio de lista) tiene que llegar a este monto. */
  min_amount?: number | null
  /** Fechas YYYY-MM-DD inclusive (opcionales). */
  starts_on: string | null
  ends_on: string | null
  /** Días de la semana 0 (domingo) a 6; vacío = todos los días. */
  weekdays: number[] | null
  active: boolean
  created_at?: string
}

export interface AppliedPromotion {
  promotionId: string
  name: string
  amount: number
}

/** Renglón de venta: un ítem del carrito puede quedar en dos (pagas y bonificadas). */
export interface PricedLine extends CartItem {
  /** Precio de lista antes de la promoción. */
  listPrice: number
  promotion: AppliedPromotion | null
}

export interface PricedCartItem {
  item: CartItem
  promotion: AppliedPromotion | null
  /** Total de la línea con la promoción aplicada. */
  total: number
}

const round2 = (value: number) => Math.round(value * 100) / 100
const round3 = (value: number) => Math.round(value * 1000) / 1000

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isPromotionActive(promotion: Promotion, now: Date = new Date()): boolean {
  if (!promotion.active) return false
  const today = localDateKey(now)
  if (promotion.starts_on && today < promotion.starts_on) return false
  if (promotion.ends_on && today > promotion.ends_on) return false
  if (promotion.weekdays?.length && !promotion.weekdays.includes(now.getDay())) return false
  return true
}

export function promotionAppliesTo(promotion: Promotion, product: { id: string; category_id?: string | null }): boolean {
  const products = promotion.product_ids ?? []
  if (products.length > 0) return products.includes(product.id)
  if (promotion.category_id) return promotion.category_id === product.category_id
  return true
}

const clampPercent = (percent: number | null) => Math.min(100, Math.max(0, percent ?? 0))

/** Divide una línea según la promoción: [cantidad, precio unitario][] (vacío si no aplica). */
function splitQuantities(promotion: Promotion, quantity: number, unitPrice: number): Array<[number, number]> {
  if (quantity <= 0 || unitPrice <= 0) return []
  switch (promotion.kind) {
    case 'nxm': {
      const buy = Math.floor(promotion.buy_qty ?? 0)
      const pay = Math.floor(promotion.pay_qty ?? 0)
      if (buy < 2 || pay < 1 || pay >= buy) return []
      const free = Math.floor(quantity / buy) * (buy - pay)
      if (free <= 0) return []
      return [[round3(quantity - free), unitPrice], [free, 0]]
    }
    case 'second_unit': {
      const discounted = Math.floor(quantity / 2)
      const percent = clampPercent(promotion.percent)
      if (discounted <= 0 || percent <= 0) return []
      return [[round3(quantity - discounted), unitPrice], [discounted, round2(unitPrice * (100 - percent) / 100)]]
    }
    case 'percent': {
      const percent = clampPercent(promotion.percent)
      if (percent <= 0) return []
      return [[quantity, round2(unitPrice * (100 - percent) / 100)]]
    }
    default:
      return []
  }
}

/** Descuento exacto que una promoción le hace a una línea (cantidad × precio). */
export function promotionDiscount(promotion: Promotion, quantity: number, unitPrice: number): number {
  const parts = splitQuantities(promotion, quantity, unitPrice)
  if (parts.length === 0) return 0
  const promoTotal = parts.reduce((sum, [qty, price]) => sum + qty * price, 0)
  return round2(quantity * unitPrice - promoTotal)
}

export function describePromotion(promotion: Pick<Promotion, 'kind' | 'buy_qty' | 'pay_qty' | 'percent' | 'min_amount'>): string {
  if (promotion.kind === 'nxm') return `${promotion.buy_qty}x${promotion.pay_qty}`
  if (promotion.kind === 'second_unit') return `2da unidad al ${100 - (promotion.percent ?? 0)}%`
  if (promotion.kind === 'min_total') return `${promotion.percent}% off desde $${Number(promotion.min_amount ?? 0).toLocaleString('es-AR')}`
  return `${promotion.percent}% off`
}

/** Aplica a cada ítem la mejor promoción vigente (no se acumulan). */
export function priceCart(items: CartItem[], promotions: Promotion[], now: Date = new Date()) {
  const active = promotions.filter((promotion) => isPromotionActive(promotion, now))
  const perItem: PricedCartItem[] = []
  const lines: PricedLine[] = []

  // Descuento por monto mínimo: el mayor % cuyo mínimo alcanza la compra. Va como % en los
  // productos que no tienen otra promoción (no se acumulan).
  const cartList = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const minTotal = active
    .filter((p) => p.kind === 'min_total' && cartList >= (Number(p.min_amount) || 0))
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0]
  const minTotalAsPercent = minTotal ? { ...minTotal, kind: 'percent' as const } : null

  for (const item of items) {
    let best: { promotion: Promotion; amount: number } | null = null
    for (const promotion of active) {
      if (promotion.kind === 'min_total' || !promotionAppliesTo(promotion, item.product)) continue
      const amount = promotionDiscount(promotion, item.quantity, item.price)
      if (amount > 0 && (!best || amount > best.amount)) best = { promotion, amount }
    }
    if (!best && minTotalAsPercent && promotionAppliesTo(minTotalAsPercent, item.product)) {
      const amount = promotionDiscount(minTotalAsPercent, item.quantity, item.price)
      if (amount > 0) best = { promotion: minTotalAsPercent, amount }
    }

    if (!best) {
      perItem.push({ item, promotion: null, total: round2(item.quantity * item.price) })
      lines.push({ ...item, listPrice: item.price, promotion: null })
      continue
    }

    const applied: AppliedPromotion = { promotionId: best.promotion.id, name: best.promotion.name, amount: best.amount }
    perItem.push({ item, promotion: applied, total: round2(item.quantity * item.price - best.amount) })
    for (const [quantity, price] of splitQuantities(best.promotion, item.quantity, item.price)) {
      if (quantity > 0) lines.push({ ...item, quantity, price, listPrice: item.price, promotion: applied })
    }
  }

  const listSubtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0))
  return {
    items: perItem,
    lines,
    listSubtotal,
    subtotal,
    promoDiscount: round2(listSubtotal - subtotal),
    applied: perItem.flatMap((entry) => (entry.promotion ? [entry.promotion] : [])),
  }
}

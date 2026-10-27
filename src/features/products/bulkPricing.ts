// Cambio masivo de precios (aumentos por inflación, listas de proveedor, etc.).

export type PriceChangeMode = 'percent' | 'amount'
export type PriceTarget = 'sale' | 'cost' | 'both'
/** Redondeo hacia arriba al múltiplo indicado (0 = sin redondeo, solo centavos). */
export type PriceRounding = 0 | 10 | 50 | 100

export interface PriceChangeRule {
  mode: PriceChangeMode
  /** Positivo aumenta, negativo baja (porcentaje o pesos). */
  value: number
  target: PriceTarget
  rounding: PriceRounding
}

export function applyPriceRule(price: number, rule: Pick<PriceChangeRule, 'mode' | 'value' | 'rounding'>): number {
  const base = Number(price) || 0
  const raw = rule.mode === 'percent' ? base * (1 + rule.value / 100) : base + rule.value
  const positive = Math.max(0, raw)
  if (rule.rounding > 0) return Math.ceil(Math.round(positive * 100) / 100 / rule.rounding) * rule.rounding
  return Math.round(positive * 100) / 100
}

export interface ProductPriceChange {
  id: string
  name: string
  oldSale: number
  newSale: number
  oldCost: number
  newCost: number
  oldWholesale: number | null
  newWholesale: number | null
}

export function planPriceChanges(
  products: Array<{ id: string; name: string; sale_price: number; purchase_price: number; wholesale_price?: number | null }>,
  rule: PriceChangeRule
): ProductPriceChange[] {
  return products.map((product) => {
    const oldSale = Number(product.sale_price) || 0
    const oldCost = Number(product.purchase_price) || 0
    const oldWholesale = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : null
    return {
      id: product.id,
      name: product.name,
      oldSale,
      newSale: rule.target === 'cost' ? oldSale : applyPriceRule(oldSale, rule),
      oldCost,
      // El costo no se redondea a múltiplos: es lo que cobra el proveedor.
      newCost: rule.target === 'sale' ? oldCost : applyPriceRule(oldCost, { ...rule, rounding: 0 }),
      // El precio mayorista acompaña al de venta.
      oldWholesale,
      newWholesale: oldWholesale === null || rule.target === 'cost' ? oldWholesale : applyPriceRule(oldWholesale, rule),
    }
  })
}

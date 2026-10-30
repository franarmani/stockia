export interface MarginMarkupResult {
  cost: number
  price: number
  profit: number
  marginPercent: number  // (price - cost) / price * 100
  markupPercent: number  // (price - cost) / cost * 100
  isBelowMinMargin: boolean
}

/**
 * Calcula margen, markup y ganancia unitaria con precisión matemática.
 * Margen: % de ganancia sobre el precio de venta final.
 * Markup: % de recargo aplicado sobre el costo.
 */
export function calculateMargins(
  cost: number,
  price: number,
  marginMin?: number | null
): MarginMarkupResult {
  const c = Math.max(0, Number(cost) || 0)
  const p = Math.max(0, Number(price) || 0)
  const profit = Math.round((p - c) * 100) / 100

  // Margen sobre precio de venta
  const marginPercent = p > 0 ? Math.round(((p - c) / p) * 10000) / 100 : 0

  // Markup sobre costo
  const markupPercent = c > 0 ? Math.round(((p - c) / c) * 10000) / 100 : 0

  const isBelowMinMargin = marginMin != null && marginMin > 0 && marginPercent < marginMin

  return {
    cost: c,
    price: p,
    profit,
    marginPercent,
    markupPercent,
    isBelowMinMargin,
  }
}

export interface SaleProfitabilitySnapshot {
  saleId: string
  totalRevenue: number
  totalCost: number
  grossProfit: number
  grossMarginPercent: number
}

/**
 * Calcula la rentabilidad histórica de una venta utilizando el costo congelado
 * en cada renglón (cost_unit), sin depender de si el costo del producto subió después.
 */
export function calculateHistoricalSaleProfitability(
  items: Array<{ quantity: number; price: number; cost_unit?: number | null }>,
  currentProductCostFallback?: number
): { totalRevenue: number; totalCost: number; grossProfit: number; grossMarginPercent: number } {
  let totalRevenue = 0
  let totalCost = 0

  for (const item of items) {
    const qty = Number(item.quantity) || 0
    const price = Number(item.price) || 0
    // Usar el costo histórico guardado en el ítem; si no existiera en ventas viejas, fallback
    const costUnit = item.cost_unit != null ? Number(item.cost_unit) : (currentProductCostFallback ?? 0)

    totalRevenue += qty * price
    totalCost += qty * costUnit
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100
  totalCost = Math.round(totalCost * 100) / 100
  const grossProfit = Math.round((totalRevenue - totalCost) * 100) / 100
  const grossMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    grossMarginPercent,
  }
}


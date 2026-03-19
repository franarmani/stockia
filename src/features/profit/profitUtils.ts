/**
 * Profit / margin utilities for STOCKIA
 */

export function grossMarginPct(salePrice: number, cost: number): number {
  if (salePrice <= 0) return 0
  return ((salePrice - cost) / salePrice) * 100
}

export function markupPct(salePrice: number, cost: number): number {
  if (cost <= 0) return 0
  return ((salePrice - cost) / cost) * 100
}

export function lineProfit(qty: number, salePrice: number, cost: number): number {
  return qty * (salePrice - cost)
}

export function profitColor(margin: number): string {
  if (margin >= 30) return 'text-green-400'
  if (margin >= 15) return 'text-amber-400'
  return 'text-red-400'
}

export function formatMargin(margin: number): string {
  return `${margin.toFixed(1)}%`
}

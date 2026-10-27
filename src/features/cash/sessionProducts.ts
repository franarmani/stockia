import { supabase } from '@/lib/supabase'
import { cachedRead } from '@/sync/remote'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalProducts } from '@/sync/storage'
import { CONSUMPTION_NOTE } from '@/features/stock/consumption'

export interface SoldLine { product_id: string; quantity: number; total: number }
export interface ProductSummary { product_id: string; name: string; quantity: number; total: number }
export interface ConsumptionLine { product_id: string; name: string; employee: string; quantity: number; cost: number }

/** Suma cantidades e importes por producto, de mayor a menor importe. */
export function summarizeSoldProducts(lines: SoldLine[], names: Map<string, string>): ProductSummary[] {
  const byProduct = new Map<string, ProductSummary>()
  for (const line of lines) {
    const current = byProduct.get(line.product_id) ?? { product_id: line.product_id, name: names.get(line.product_id) ?? 'Producto eliminado', quantity: 0, total: 0 }
    current.quantity = Math.round((current.quantity + (Number(line.quantity) || 0)) * 1000) / 1000
    current.total = Math.round((current.total + (Number(line.total) || 0)) * 100) / 100
    byProduct.set(line.product_id, current)
  }
  return [...byProduct.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'))
}

/** Productos vendidos y consumos de empleados entre la apertura y el cierre (o ahora) de una caja. */
export async function loadSessionProducts(businessId: string, sessionId: string, from: string, to: string | null) {
  const products = await getLocalProducts(businessId)
  const names = new Map(products.map((p) => [p.id, p.name]))
  const costs = new Map(products.map((p) => [p.id, Number((p as any).purchase_price) || 0]))

  const remote = await cachedRead(`cash_products:${sessionId}`, async () => {
    let sales = (supabase as any).from('sales').select('id, voided, sale_items(product_id, quantity, line_total)')
      .eq('business_id', businessId).gte('created_at', from)
    if (to) sales = sales.lte('created_at', to)
    let consumption = (supabase as any).from('stock_movements').select('product_id, qty_delta, quantity, notes')
      .eq('business_id', businessId).like('notes', `${CONSUMPTION_NOTE}:%`).gte('created_at', from)
    if (to) consumption = consumption.lte('created_at', to)
    const [salesResult, consumptionResult] = await Promise.all([sales, consumption])
    if (salesResult.error) throw salesResult.error
    if (consumptionResult.error) throw consumptionResult.error
    return { sales: salesResult.data ?? [], consumption: consumptionResult.data ?? [] }
  }).catch(() => ({ sales: [] as any[], consumption: [] as any[] }))

  const lines: SoldLine[] = []
  const remoteIds = new Set<string>()
  for (const sale of remote.sales) {
    remoteIds.add(sale.id)
    if (sale.voided) continue
    for (const item of sale.sale_items ?? []) lines.push({ product_id: item.product_id, quantity: item.quantity, total: item.line_total })
  }
  // Ventas hechas sin internet que todavía no llegaron al servidor.
  for (const pending of await syncEngine.getPendingSales(businessId)) {
    if (remoteIds.has(pending.sale.id) || pending.sale.created_at < from || (to && pending.sale.created_at > to)) continue
    for (const item of pending.items) lines.push({ product_id: item.product_id, quantity: item.quantity, total: item.price * item.quantity })
  }

  const consumption: ConsumptionLine[] = remote.consumption.map((m: any) => {
    const quantity = Math.abs(Number(m.qty_delta ?? m.quantity) || 0)
    return {
      product_id: m.product_id,
      name: names.get(m.product_id) ?? 'Producto eliminado',
      employee: String(m.notes ?? '').slice(CONSUMPTION_NOTE.length + 1).trim(),
      quantity,
      cost: Math.round(quantity * (costs.get(m.product_id) ?? 0) * 100) / 100,
    }
  })

  return { sold: summarizeSoldProducts(lines, names), consumption }
}

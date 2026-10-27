export interface Warehouse {
  id: string
  business_id: string
  name: string
  created_at?: string
}

export interface WarehouseStockRow {
  id: string
  business_id: string
  warehouse_id: string
  product_id: string
  quantity: number
}

/** Cantidad por depósito de cada producto: productId → (warehouseId → cantidad). */
export function stockByProduct(rows: WarehouseStockRow[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const qty = Number(row.quantity) || 0
    if (!qty) continue
    const byWarehouse = result.get(row.product_id) ?? new Map<string, number>()
    byWarehouse.set(row.warehouse_id, (byWarehouse.get(row.warehouse_id) ?? 0) + qty)
    result.set(row.product_id, byWarehouse)
  }
  return result
}

/** El Local es el stock de venta: el total del producto menos lo guardado en depósitos. */
export function localStock(totalStock: number, byWarehouse: Map<string, number> | undefined): number {
  let stored = 0
  for (const qty of byWarehouse?.values() ?? []) stored += qty
  return Math.round(((Number(totalStock) || 0) - stored) * 1000) / 1000
}

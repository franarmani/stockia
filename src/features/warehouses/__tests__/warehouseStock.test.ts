import { describe, expect, it } from 'vitest'
import { localStock, stockByProduct, type WarehouseStockRow } from '../warehouseStock'

const row = (warehouse_id: string, product_id: string, quantity: number): WarehouseStockRow =>
  ({ id: `${warehouse_id}-${product_id}`, business_id: 'b', warehouse_id, product_id, quantity })

describe('stock por depósito', () => {
  it('agrupa las cantidades por producto y depósito', () => {
    const map = stockByProduct([row('d1', 'p1', 5), row('d2', 'p1', 3), row('d1', 'p2', 0)])
    expect(map.get('p1')?.get('d1')).toBe(5)
    expect(map.get('p1')?.get('d2')).toBe(3)
    expect(map.has('p2')).toBe(false)
  })
  it('el Local es el total menos lo que está en depósitos', () => {
    const map = stockByProduct([row('d1', 'p1', 5), row('d2', 'p1', 3)])
    expect(localStock(20, map.get('p1'))).toBe(12)
    expect(localStock(20, undefined)).toBe(20)
  })
  it('si se vendió de más, el Local queda negativo', () => {
    const map = stockByProduct([row('d1', 'p1', 5)])
    expect(localStock(3, map.get('p1'))).toBe(-2)
  })
})

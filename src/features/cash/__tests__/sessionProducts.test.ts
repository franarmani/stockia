import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/sync/remote', () => ({ cachedRead: vi.fn() }))
vi.mock('@/sync/syncEngine', () => ({ syncEngine: {} }))
vi.mock('@/sync/storage', () => ({ getLocalProducts: vi.fn() }))

import { summarizeSoldProducts } from '../sessionProducts'

describe('productos vendidos en la caja', () => {
  it('suma por producto y ordena por importe', () => {
    const names = new Map([['a', 'Arena'], ['b', 'Cemento']])
    const result = summarizeSoldProducts([
      { product_id: 'a', quantity: 2, total: 200 },
      { product_id: 'b', quantity: 1, total: 900 },
      { product_id: 'a', quantity: 1.5, total: 150 },
    ], names)
    expect(result).toEqual([
      { product_id: 'b', name: 'Cemento', quantity: 1, total: 900 },
      { product_id: 'a', name: 'Arena', quantity: 3.5, total: 350 },
    ])
  })
  it('marca los productos que ya no existen', () => {
    expect(summarizeSoldProducts([{ product_id: 'x', quantity: 1, total: 10 }], new Map())[0].name).toBe('Producto eliminado')
  })
})

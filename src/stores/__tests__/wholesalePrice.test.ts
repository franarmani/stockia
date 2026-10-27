import { describe, expect, it } from 'vitest'
import { unitPrice, usePOSStore } from '../posStore'
import type { Product } from '@/types/database'

const product = { id: 'p1', name: 'Cemento', sale_price: 100, wholesale_price: 80, wholesale_min_qty: 10, unit: 'u', stock: 100 } as unknown as Product

describe('precio mayorista', () => {
  it('usa el precio normal por debajo del mínimo', () => {
    expect(unitPrice(product, 9, false)).toBe(100)
  })
  it('aplica el mayorista desde la cantidad mínima', () => {
    expect(unitPrice(product, 10, false)).toBe(80)
  })
  it('aplica el mayorista al cliente mayorista con cualquier cantidad', () => {
    expect(unitPrice(product, 1, true)).toBe(80)
  })
  it('sin precio mayorista cargado siempre cobra el normal', () => {
    const plain = { ...product, wholesale_price: null } as unknown as Product
    expect(unitPrice(plain, 50, true)).toBe(100)
  })
  it('el carrito recalcula al cambiar cantidad y cliente', () => {
    const store = usePOSStore.getState()
    store.clearCart()
    store.addItem(product)
    expect(usePOSStore.getState().items[0].price).toBe(100)
    usePOSStore.getState().updateQuantity('p1', 12)
    expect(usePOSStore.getState().items[0].price).toBe(80)
    usePOSStore.getState().updateQuantity('p1', 2)
    expect(usePOSStore.getState().items[0].price).toBe(100)
    usePOSStore.getState().setWholesaleCustomer(true)
    expect(usePOSStore.getState().items[0].price).toBe(80)
    usePOSStore.getState().clearCart()
  })
})

import { describe, expect, it } from 'vitest'
import { isPromotionActive, priceCart, promotionDiscount, type Promotion } from '../promotionEngine'

const base: Promotion = {
  id: 'p', name: 'Promo', kind: 'nxm', product_ids: null, category_id: null,
  buy_qty: 2, pay_qty: 1, percent: null, starts_on: null, ends_on: null, weekdays: null, active: true,
}
const product = (id: string, category_id: string | null = null) => ({ id, category_id, stock: 100, sale_price: 100 } as any)
const line = (id: string, quantity: number, price = 100, category: string | null = null) => ({ product: product(id, category), quantity, price })

describe('promotion discounts', () => {
  it('2x1 and 3x2 only discount complete groups', () => {
    expect(promotionDiscount(base, 1, 100)).toBe(0)
    expect(promotionDiscount(base, 2, 100)).toBe(100)
    expect(promotionDiscount(base, 5, 100)).toBe(200)
    expect(promotionDiscount({ ...base, buy_qty: 3, pay_qty: 2 }, 7, 90)).toBe(180)
  })

  it('percent and second-unit discounts', () => {
    expect(promotionDiscount({ ...base, kind: 'percent', percent: 15 }, 3, 200)).toBe(90)
    expect(promotionDiscount({ ...base, kind: 'second_unit', percent: 50 }, 3, 100)).toBe(50)
  })

  it('ignores nonsensical configurations', () => {
    expect(promotionDiscount({ ...base, buy_qty: 2, pay_qty: 2 }, 4, 100)).toBe(0)
    expect(promotionDiscount({ ...base, kind: 'percent', percent: 150 }, 1, 100)).toBe(100)
  })
})

describe('promotion schedule', () => {
  const wednesday = new Date(2026, 9, 28, 12)
  it('respects dates, weekdays and the active flag', () => {
    expect(isPromotionActive(base, wednesday)).toBe(true)
    expect(isPromotionActive({ ...base, active: false }, wednesday)).toBe(false)
    expect(isPromotionActive({ ...base, starts_on: '2026-10-29' }, wednesday)).toBe(false)
    expect(isPromotionActive({ ...base, ends_on: '2026-10-28' }, wednesday)).toBe(true)
    expect(isPromotionActive({ ...base, ends_on: '2026-10-27' }, wednesday)).toBe(false)
    expect(isPromotionActive({ ...base, weekdays: [3] }, wednesday)).toBe(true)
    expect(isPromotionActive({ ...base, weekdays: [5, 6] }, wednesday)).toBe(false)
  })
})

describe('cart pricing', () => {
  it('moves the discount into the line unit price so totals stay consistent', () => {
    const result = priceCart([line('coca', 3, 100), line('pan', 1, 50)], [{ ...base, product_ids: ['coca'] }])
    expect(result.listSubtotal).toBe(350)
    expect(result.promoDiscount).toBe(100)
    expect(result.subtotal).toBe(250)
    // 3 unidades en 2x1: 2 pagas a $100 y 1 bonificada a $0 (sin el centavo de $66,67 × 3)
    expect(result.lines.filter(l => l.product.id === 'coca').map(l => [l.quantity, l.price])).toEqual([[2, 100], [1, 0]])
    expect(result.items[0].total).toBe(200)
    expect(result.items[1].promotion).toBeNull()
  })

  it('applies the best promotion per line without stacking', () => {
    const promos: Promotion[] = [
      { ...base, id: 'cat', name: '10% bebidas', kind: 'percent', percent: 10, category_id: 'bebidas' },
      { ...base, id: 'nxm', name: '2x1 Coca', product_ids: ['coca'] },
    ]
    const result = priceCart([line('coca', 2, 100, 'bebidas'), line('agua', 2, 100, 'bebidas')], promos)
    expect(result.items[0].promotion?.promotionId).toBe('nxm')
    expect(result.items[1].promotion?.promotionId).toBe('cat')
    expect(result.promoDiscount).toBe(120)
  })

  it('sale lines always add up exactly to the charged subtotal', () => {
    const promos: Promotion[] = [
      { ...base, id: 'a', kind: 'percent', percent: 33, product_ids: ['x'] },
      { ...base, id: 'b', kind: 'second_unit', percent: 50, product_ids: ['y'] },
      { ...base, id: 'c', buy_qty: 3, pay_qty: 2, product_ids: ['z'] },
    ]
    const result = priceCart([line('x', 3, 10.99), line('y', 5, 7.33), line('z', 7, 13.5)], promos)
    const linesTotal = Math.round(result.lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100
    const itemsTotal = Math.round(result.items.reduce((s, i) => s + i.total, 0) * 100) / 100
    expect(linesTotal).toBe(result.subtotal)
    expect(itemsTotal).toBe(result.subtotal)
    expect(Math.round((result.listSubtotal - result.promoDiscount) * 100) / 100).toBe(result.subtotal)
    // la cantidad vendida de cada producto no cambia al partir las líneas
    expect(result.lines.filter(l => l.product.id === 'z').reduce((s, l) => s + l.quantity, 0)).toBe(7)
  })
})

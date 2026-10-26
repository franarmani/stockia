import { describe, expect, it } from 'vitest'
import { applyFreeUnit, canRedeem, combineDiscounts, pointsForPurchase, readLoyaltyConfig } from '../loyalty'

const line = (id: string, quantity: number, price: number) =>
  ({ product: { id } as any, quantity, price, listPrice: price, promotion: null })

describe('loyalty club', () => {
  it('earns one point per configured amount spent', () => {
    const config = { enabled: true, amount_per_point: 1000 }
    expect(pointsForPurchase(999.99, config)).toBe(0)
    expect(pointsForPurchase(1000, config)).toBe(1)
    expect(pointsForPurchase(25499, config)).toBe(25)
    expect(pointsForPurchase(5000, { ...config, enabled: false })).toBe(0)
  })

  it('reads a missing or broken config safely', () => {
    expect(readLoyaltyConfig(null)).toEqual({ enabled: false, amount_per_point: 1000 })
    expect(readLoyaltyConfig({ enabled: true, amount_per_point: -5 })).toEqual({ enabled: true, amount_per_point: 1000 })
  })

  it('stacks percentage discounts multiplicatively', () => {
    expect(combineDiscounts(0, 15)).toBe(15)
    expect(combineDiscounts(10, 10)).toBe(19)
    expect(combineDiscounts(20, 0)).toBe(20)
  })

  it('makes exactly one unit of the reward product free', () => {
    const lines = [line('a', 3, 100), line('b', 1, 50)]
    const result = applyFreeUnit(lines, 'a', 'Premio')!
    expect(result.map((l) => [l.product.id, l.quantity, l.price])).toEqual([['a', 2, 100], ['a', 1, 0], ['b', 1, 50]])
    expect(applyFreeUnit([line('a', 1, 100)], 'a', 'Premio')!.map((l) => l.price)).toEqual([0])
    expect(applyFreeUnit(lines, 'zzz', 'Premio')).toBeNull()
    expect(applyFreeUnit([line('kg', 0.5, 100)], 'kg', 'Premio')).toBeNull()
  })

  it('only allows redeeming affordable rewards whose product is in the cart', () => {
    const reward = { id: 'r', name: 'Café gratis', points_cost: 50, kind: 'product' as const, product_id: 'cafe', percent: null, active: true }
    expect(canRedeem(reward, 40, ['cafe'])).toMatchObject({ ok: false, reason: 'Le faltan 10 puntos' })
    expect(canRedeem(reward, 60, ['pan'])).toMatchObject({ ok: false })
    expect(canRedeem(reward, 60, ['cafe'])).toEqual({ ok: true })
  })
})

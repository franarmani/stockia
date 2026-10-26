import { describe, expect, it } from 'vitest'
import { legacySaleToPayload } from '../legacyMigration'

describe('legacy offline queue migration', () => {
  const legacy = {
    id: 'offline-1700000000000-abc123',
    createdAt: '2026-10-01T12:00:00.000Z',
    payload: {
      sale: { business_id: 'biz', customer_id: 'cus', total: 300, discount: 0, payment_method: 'account', seller_id: 'usr', receipt_type: 'ticket', installments: 1, surcharge_pct: 0 },
      items: [{ product_id: 'p1', quantity: 2, price: 150, cost_at_sale: 90 }],
      payments: [{ payment_method: 'account', amount: 300 }],
      stockUpdates: [{ productId: 'p1', newStock: 8, qty: 2 }],
      accountUpdate: { customerId: 'cus', amount: 300 },
    },
  }

  it('converts an old sale into an idempotent unified payload', () => {
    const payload = legacySaleToPayload(legacy)
    const uuid = /^[0-9a-f-]{36}$/i

    expect(payload.sale.id).toMatch(uuid)
    expect(payload.sale.created_at).toBe(legacy.createdAt)
    expect(payload.sale.fiscal_status).toBe('pending')
    expect(payload.sale.receipt_type).toBe('ticket')
    expect(payload.items[0]).toMatchObject({ sale_id: payload.sale.id, product_id: 'p1', quantity: 2, price: 150 })
    expect(payload.items[0].id).toMatch(uuid)
    expect(payload.payments[0]).toMatchObject({ sale_id: payload.sale.id, amount: 300 })
    expect(payload.stockUpdates[0].movementId).toMatch(uuid)
    expect(payload.accountUpdate).toEqual({ customerId: 'cus', amount: 300 })
  })

  it('generates fresh ids for every conversion', () => {
    expect(legacySaleToPayload(legacy).sale.id).not.toBe(legacySaleToPayload(legacy).sale.id)
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('html2pdf.js', () => ({ default: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/documentLayout', () => ({ inlineImage: vi.fn() }))

import { buildStatement } from '../accountStatement'

describe('estado de cuenta corriente', () => {
  it('ordena por fecha y acumula el saldo', () => {
    const rows = buildStatement([
      { type: 'payment', amount: 300, note: null, created_at: '2026-10-03T10:00:00Z', sale_id: null },
      { type: 'charge', amount: 1000, note: null, created_at: '2026-10-01T10:00:00Z', sale_id: 's1' },
      { type: 'adjust', amount: -100, note: 'Bonificación', created_at: '2026-10-05T10:00:00Z', sale_id: null },
    ])
    expect(rows.map(r => [r.concept, r.charge, r.payment, r.balance])).toEqual([
      ['Compra a cuenta', 1000, 0, 1000],
      ['Pago', 0, 300, 700],
      ['Bonificación', 0, 100, 600],
    ])
  })
})

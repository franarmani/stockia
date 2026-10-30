import { describe, it, expect } from 'vitest'
import { buildSupplierStatement, calculateSupplierDebtSummary } from '../supplierCredit'
import type { SupplierMovement } from '@/types/database'

describe('Cuenta Corriente de Proveedores', () => {
  const sampleMovements: SupplierMovement[] = [
    {
      id: 'mov-1',
      business_id: 'biz-1',
      supplier_id: 'sup-1',
      purchase_id: 'pur-1',
      type: 'purchase',
      amount: 100000,
      balance_after: 100000,
      document_ref: 'FC-0001-00001234',
      due_date: '2026-10-15',
      note: 'Factura mercadería',
      user_id: 'usr-1',
      created_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 'mov-2',
      business_id: 'biz-1',
      supplier_id: 'sup-1',
      purchase_id: null,
      type: 'payment',
      amount: 40000,
      balance_after: 60000,
      document_ref: 'REC-001',
      due_date: null,
      note: 'Pago parcial transferencia',
      user_id: 'usr-1',
      created_at: '2026-10-05T12:00:00Z',
    },
  ]

  it('builds statement with running balance correctly (spec: $100.000 purchase, $40.000 payment -> $60.000 balance)', () => {
    const rows = buildSupplierStatement(sampleMovements)
    expect(rows).toHaveLength(2)
    expect(rows[0].charge).toBe(100000)
    expect(rows[0].payment).toBe(0)
    expect(rows[0].balance).toBe(100000)

    expect(rows[1].charge).toBe(0)
    expect(rows[1].payment).toBe(40000)
    expect(rows[1].balance).toBe(60000)
  })

  it('calculates debt summary identifying overdue debt correctly', () => {
    const fakeToday = new Date('2026-10-20T00:00:00Z')
    const summary = calculateSupplierDebtSummary(sampleMovements, fakeToday)

    expect(summary.totalDebt).toBe(60000)
    expect(summary.hasOverdue).toBe(true)
    expect(summary.overdueDebt).toBe(60000)
  })
})


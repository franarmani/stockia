import { describe, expect, it } from 'vitest'
import { getEntryTotals, isBalancedEntry } from '@/features/accounting/accountingValidation'
import { fromCents, multiplyMoney } from '../money'

function calculateVat(net: string, rate: number) {
  return Math.round(multiplyMoney(net, 1) * rate / 100)
}

describe('alicuotas IVA compras', () => {
  it.each([
    ['100000', 21, 2100000],
    ['100000', 10.5, 1050000],
    ['100000', 27, 2700000],
  ])('calcula IVA %s al %s%%', (net, rate, expectedCents) => {
    expect(calculateVat(net, rate)).toBe(expectedCents)
  })

  it('suma una factura con multiples alicuotas', () => {
    const netCents = multiplyMoney('10000', 3)
    const vatCents = calculateVat('10000', 10.5) + calculateVat('10000', 21) + calculateVat('10000', 27)
    expect(fromCents(netCents + vatCents)).toBe('35850.00')
  })
})

describe('asientos contables', () => {
  it('acepta Debe igual a Haber', () => {
    const lines = [{ debit: '100000', credit: 0 }, { debit: '21000', credit: 0 }, { debit: 0, credit: '121000' }]
    expect(isBalancedEntry(lines)).toBe(true)
    expect(getEntryTotals(lines)).toEqual({ debit: 12100000, credit: 12100000 })
  })

  it('rechaza un asiento desbalanceado', () => {
    expect(isBalancedEntry([{ debit: '100', credit: 0 }, { debit: 0, credit: '99.99' }])).toBe(false)
  })

  it('rechaza un asiento vacio', () => {
    expect(isBalancedEntry([{ debit: 0, credit: 0 }])).toBe(false)
  })
})

describe('cuenta corriente proveedor', () => {
  it('reconstruye factura, pago parcial, nota de credito y pago final', () => {
    const movements = [
      { debit: 12100000, credit: 0 },
      { debit: 0, credit: 6000000 },
      { debit: 0, credit: 1000000 },
      { debit: 0, credit: 5100000 },
    ]
    expect(movements.reduce((balance, movement) => balance + movement.debit - movement.credit, 0)).toBe(0)
  })
})

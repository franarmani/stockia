import { describe, expect, it } from 'vitest'
import { applyPriceRule, planPriceChanges } from '../bulkPricing'
import { barcodeFormat, expandLabels } from '../labels'

describe('bulk price changes', () => {
  it('applies percent and fixed changes, never below zero', () => {
    expect(applyPriceRule(1000, { mode: 'percent', value: 12.5, rounding: 0 })).toBe(1125)
    expect(applyPriceRule(999.99, { mode: 'percent', value: -10, rounding: 0 })).toBe(899.99)
    expect(applyPriceRule(500, { mode: 'amount', value: 150, rounding: 0 })).toBe(650)
    expect(applyPriceRule(100, { mode: 'amount', value: -300, rounding: 0 })).toBe(0)
  })

  it('rounds sale prices up to the chosen multiple', () => {
    expect(applyPriceRule(1000, { mode: 'percent', value: 7, rounding: 10 })).toBe(1070)
    expect(applyPriceRule(1003, { mode: 'percent', value: 0, rounding: 10 })).toBe(1010)
    expect(applyPriceRule(1201, { mode: 'percent', value: 0, rounding: 100 })).toBe(1300)
    expect(applyPriceRule(1200, { mode: 'percent', value: 0, rounding: 100 })).toBe(1200)
  })

  it('changes only the chosen target and never rounds costs', () => {
    const products = [{ id: 'a', name: 'A', sale_price: 1000, purchase_price: 600 }]
    expect(planPriceChanges(products, { mode: 'percent', value: 10, target: 'sale', rounding: 50 })[0])
      .toMatchObject({ newSale: 1100, newCost: 600 })
    expect(planPriceChanges(products, { mode: 'percent', value: 10, target: 'cost', rounding: 50 })[0])
      .toMatchObject({ newSale: 1000, newCost: 660 })
    expect(planPriceChanges(products, { mode: 'percent', value: 5, target: 'both', rounding: 100 })[0])
      .toMatchObject({ newSale: 1100, newCost: 630 })
  })
})

describe('barcode labels', () => {
  it('uses EAN-13 only for valid 13-digit codes', () => {
    expect(barcodeFormat('7790895000997')).toBe('EAN13')
    expect(barcodeFormat('7790895000990')).toBe('CODE128')
    expect(barcodeFormat('ABC-123')).toBe('CODE128')
    expect(barcodeFormat('')).toBeNull()
    expect(barcodeFormat(null)).toBeNull()
  })

  it('repeats each product by its number of copies', () => {
    const labels = expandLabels([
      { product: { id: 'a', name: 'A', sale_price: 1, barcode: '1' }, copies: 2 },
      { product: { id: 'b', name: 'B', sale_price: 1, barcode: null }, copies: 0 },
      { product: { id: 'c', name: 'C', sale_price: 1, barcode: '3' }, copies: 1 },
    ])
    expect(labels.map((label) => label.id)).toEqual(['a', 'a', 'c'])
  })
})

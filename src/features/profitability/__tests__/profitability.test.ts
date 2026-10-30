import { describe, it, expect } from 'vitest'
import { calculateMargins, calculateHistoricalSaleProfitability } from '../profitabilityService'

describe('Cálculo de Márgenes, Markup y Rentabilidad Histórica', () => {
  it('calculates exact margin and markup from spec #34: Cost $60, Price $100 -> Margin 40%, Markup 66.67%', () => {
    const res = calculateMargins(60, 100)
    expect(res.profit).toBe(40)
    expect(res.marginPercent).toBe(40)
    expect(res.markupPercent).toBe(66.67)
  })

  it('detects when margin is below minimum margin', () => {
    // Cost $85, Price $100 -> Margin 15%. Minimum margin is 20%
    const res = calculateMargins(85, 100, 20)
    expect(res.marginPercent).toBe(15)
    expect(res.isBelowMinMargin).toBe(true)
  })

  it('calculates historical sale profitability using frozen cost at sale time', () => {
    // Venta realizada en enero: producto costaba $5.000, vendido a $9.000
    // Hoy el producto cuesta $8.000.
    // La rentabilidad de la venta histórica debe dar $4.000 de ganancia bruta (44.44% margen)
    const saleItems = [
      { quantity: 2, price: 9000, cost_unit: 5000 },
    ]

    const result = calculateHistoricalSaleProfitability(saleItems, 8000)
    expect(result.totalRevenue).toBe(18000)
    expect(result.totalCost).toBe(10000) // 2 * $5.000, NO $8.000
    expect(result.grossProfit).toBe(8000)
    expect(result.grossMarginPercent).toBe(44.44)
  })
})


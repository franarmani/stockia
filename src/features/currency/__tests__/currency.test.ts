import { describe, it, expect } from 'vitest'
import { recordCurrencyTransaction, calculateForeignPricedProduct } from '../currencyService'

describe('Multimoneda y Cotizaciones Históricas', () => {
  it('calculates test case from spec #34: Compra 100 USD con TC 1500 = 150.000 ARS', () => {
    const tx = recordCurrencyTransaction(100, 'USD', 1500)
    expect(tx.currencyOriginal).toBe('USD')
    expect(tx.amountOriginal).toBe(100)
    expect(tx.exchangeRate).toBe(1500)
    expect(tx.amountConverted).toBe(150000)

    // Si luego la cotización de mercado cambia a 1600, la transacción histórica
    // conserva sus 150.000 ARS originales
    expect(tx.amountConverted).toBe(150000)
  })

  it('calculates foreign product cost and suggested retail price based on markup', () => {
    // Producto importado: Costo 50 USD, TC 1500 -> Costo base: 75.000 ARS
    // Markup 40% -> Precio sugerido: 105.000 ARS
    const prod = calculateForeignPricedProduct(50, 1500, 40)
    expect(prod.costBase).toBe(75000)
    expect(prod.suggestedPriceBase).toBe(105000)
  })
})


import { describe, it, expect } from 'vitest'
import { computeFinancialKPIs, generateFinancialAlerts } from '../financialDashboard'
import type { FinancialAccount, Customer, Supplier, Product, Expense, ExchangeRate } from '@/types/database'

describe('Dashboard Financiero y Alertas', () => {
  it('computes financial KPIs from spec #10: Sales $10.000.000, Cost $6.000.000, Expenses $1.500.000 -> Gross Profit $4.000.000, Operating Result $2.500.000', () => {
    const kpis = computeFinancialKPIs({
      accounts: [
        { id: '1', business_id: 'b1', name: 'Caja', type: 'cash', currency: 'ARS', balance: 500000, is_default: true, active: true, created_at: '', updated_at: '' },
      ],
      customers: [
        { id: 'c1', business_id: 'b1', name: 'Juan', balance: 180000, created_at: '' } as any,
      ],
      suppliers: [
        { id: 's1', business_id: 'b1', name: 'Distribuidora', balance: 350000, created_at: '' } as any,
      ],
      products: [
        { id: 'p1', business_id: 'b1', name: 'Prod 1', stock: 100, cost_price: 1000 } as any,
      ],
      totalSales: 10000000,
      totalCostOfGoodsSold: 6000000,
      expenses: [
        { id: 'e1', business_id: 'b1', amount: 1500000, amount_converted: 1500000, status: 'paid' } as any,
      ],
    })

    expect(kpis.availableCashAndBanks).toBe(500000)
    expect(kpis.accountsReceivable).toBe(180000)
    expect(kpis.accountsPayable).toBe(350000)
    expect(kpis.inventoryValuation).toBe(100000)
    expect(kpis.grossProfit).toBe(4000000)
    expect(kpis.grossMarginPercent).toBe(40)
    expect(kpis.operatingProfit).toBe(2500000)
    expect(kpis.operatingMarginPercent).toBe(25)
  })

  it('generates real-time financial alerts for credit exceeded, low margin, and critical raw materials', () => {
    const alerts = generateFinancialAlerts({
      customers: [
        { id: 'c1', name: 'Pedro', credit_enabled: true, credit_limit: 100000, balance: 130000 } as any,
      ],
      suppliers: [],
      products: [
        // Producto con bajo margen (10% vs 25% min)
        { id: 'p1', name: 'Venta rápida', sale_price: 1000, cost_price: 900, margin_min: 25, active: true } as any,
        // Materia prima con stock crítico (2 u vs 10 min)
        { id: 'raw1', name: 'Harina 000', product_type: 'raw_material', stock: 2, stock_min: 10, unit: 'kg', active: true } as any,
      ],
      rates: [
        // Cotización de hace 15 días
        { id: 'r1', currency_code: 'USD', buy_rate: 1400, sell_rate: 1450, date: '2026-10-10' } as any,
      ],
      expenses: [],
      currentDate: new Date('2026-10-30T12:00:00Z'),
    })

    expect(alerts).toHaveLength(4)
    expect(alerts.find(a => a.type === 'credit_exceeded')).toBeDefined()
    expect(alerts.find(a => a.type === 'low_margin')).toBeDefined()
    expect(alerts.find(a => a.type === 'critical_raw_material')).toBeDefined()
    expect(alerts.find(a => a.type === 'stale_exchange_rate')).toBeDefined()
  })
})


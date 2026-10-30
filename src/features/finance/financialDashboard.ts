import type {
  FinancialAccount,
  Customer,
  Supplier,
  Product,
  Expense,
  ExchangeRate,
} from '@/types/database'

export interface FinancialKPIs {
  availableCashAndBanks: number
  accountsReceivable: number  // Cuentas por cobrar (clientes)
  accountsPayable: number     // Cuentas por pagar (proveedores)
  inventoryValuation: number  // Valor del stock al costo
  totalSales: number
  totalCostOfGoodsSold: number
  grossProfit: number
  grossMarginPercent: number
  totalExpenses: number
  operatingProfit: number     // Ganancia operativa = Ganancia bruta - Gastos
  operatingMarginPercent: number
}

export interface FinancialAlert {
  id: string
  type: 'credit_exceeded' | 'customer_overdue' | 'supplier_due_soon' | 'supplier_overdue' | 'low_margin' | 'critical_raw_material' | 'critical_finished_stock' | 'stale_exchange_rate' | 'upcoming_recurring_expense'
  severity: 'info' | 'warn' | 'danger'
  title: string
  message: string
  actionUrl?: string
}

export function computeFinancialKPIs(data: {
  accounts: FinancialAccount[]
  customers: Customer[]
  suppliers: Supplier[]
  products: Product[]
  totalSales: number
  totalCostOfGoodsSold: number
  expenses: Expense[]
}): FinancialKPIs {
  // 1. Dinero disponible en cajas y bancos
  const availableCashAndBanks = data.accounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0)

  // 2. Cuentas por cobrar (saldo de clientes deudores)
  const accountsReceivable = data.customers
    .filter((c) => (Number(c.balance) || 0) > 0)
    .reduce((sum, c) => sum + Number(c.balance), 0)

  // 3. Cuentas por pagar (saldo adeudado a proveedores)
  const accountsPayable = data.suppliers
    .filter((s) => (Number(s.balance) || 0) > 0)
    .reduce((sum, s) => sum + Number(s.balance), 0)

  // 4. Valorización del inventario al costo
  const inventoryValuation = data.products
    .filter((p) => (Number(p.stock) || 0) > 0)
    .reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.cost_price ?? p.purchase_price) || 0), 0)

  // 5. Gastos operativos
  const totalExpenses = data.expenses
    .filter((e) => e.status !== 'cancelled')
    .reduce((sum, e) => sum + (Number(e.amount_converted) || Number(e.amount) || 0), 0)

  // 6. Rentabilidad y márgenes
  const grossProfit = Math.round((data.totalSales - data.totalCostOfGoodsSold) * 100) / 100
  const grossMarginPercent = data.totalSales > 0 ? Math.round((grossProfit / data.totalSales) * 10000) / 100 : 0
  const operatingProfit = Math.round((grossProfit - totalExpenses) * 100) / 100
  const operatingMarginPercent = data.totalSales > 0 ? Math.round((operatingProfit / data.totalSales) * 10000) / 100 : 0

  return {
    availableCashAndBanks: Math.round(availableCashAndBanks * 100) / 100,
    accountsReceivable: Math.round(accountsReceivable * 100) / 100,
    accountsPayable: Math.round(accountsPayable * 100) / 100,
    inventoryValuation: Math.round(inventoryValuation * 100) / 100,
    totalSales: Math.round(data.totalSales * 100) / 100,
    totalCostOfGoodsSold: Math.round(data.totalCostOfGoodsSold * 100) / 100,
    grossProfit,
    grossMarginPercent,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    operatingProfit,
    operatingMarginPercent,
  }
}

export function generateFinancialAlerts(data: {
  customers: Customer[]
  suppliers: Supplier[]
  products: Product[]
  rates: ExchangeRate[]
  expenses: Expense[]
  currentDate?: Date
}): FinancialAlert[] {
  const alerts: FinancialAlert[] = []
  const now = data.currentDate || new Date()
  const nowTime = now.getTime()

  // 1. Clientes que excedieron crédito
  for (const c of data.customers) {
    if (c.credit_enabled && !c.credit_unlimited && Number(c.credit_limit) > 0) {
      const bal = Number(c.balance) || 0
      const limit = Number(c.credit_limit) || 0
      if (bal > limit) {
        alerts.push({
          id: `cust-limit-${c.id}`,
          type: 'credit_exceeded',
          severity: 'danger',
          title: 'Cliente excedió límite de crédito',
          message: `${c.name} tiene un saldo de $${bal.toLocaleString('es-AR')} superando el límite de $${limit.toLocaleString('es-AR')}.`,
          actionUrl: '/customers',
        })
      }
    }
  }

  // 2. Productos con bajo margen
  for (const p of data.products) {
    if (p.active !== false && p.margin_min && p.margin_min > 0) {
      const cost = Number(p.cost_price ?? p.purchase_price) || 0
      const price = Number(p.sale_price) || 0
      if (price > 0) {
        const margin = ((price - cost) / price) * 100
        if (margin < p.margin_min) {
          alerts.push({
            id: `prod-margin-${p.id}`,
            type: 'low_margin',
            severity: 'warn',
            title: 'Producto con margen por debajo del mínimo',
            message: `${p.name} tiene un margen de ${margin.toFixed(1)}% (mínimo configurado: ${p.margin_min}%).`,
            actionUrl: '/products',
          })
        }
      }
    }
  }

  // 3. Materia prima con stock crítico
  for (const p of data.products) {
    if (p.active !== false && p.product_type === 'raw_material') {
      const stock = Number(p.stock) || 0
      const min = Number(p.stock_min) || 0
      if (stock <= min) {
        alerts.push({
          id: `raw-critical-${p.id}`,
          type: 'critical_raw_material',
          severity: 'danger',
          title: 'Materia prima con stock crítico',
          message: `${p.name} tiene stock actual de ${stock} ${p.unit || 'u'} (mínimo: ${min}).`,
          actionUrl: '/products',
        })
      }
    }
  }

  // 4. Cotización desactualizada (> 7 días)
  for (const r of data.rates) {
    const rateDate = new Date(r.date)
    const diffDays = Math.floor((nowTime - rateDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 7) {
      alerts.push({
        id: `rate-stale-${r.id}`,
        type: 'stale_exchange_rate',
        severity: 'warn',
        title: `Cotización de ${r.currency_code} desactualizada`,
        message: `La última cotización registrada para ${r.currency_code} tiene ${diffDays} días de antigüedad.`,
        actionUrl: '/settings',
      })
    }
  }

  return alerts
}

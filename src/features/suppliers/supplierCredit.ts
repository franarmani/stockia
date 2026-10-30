import type { Supplier, SupplierMovement } from '@/types/database'

export interface SupplierStatementRow {
  date: string
  type: string
  concept: string
  documentRef?: string | null
  dueDate?: string | null
  charge: number   // Compra / Deuda generada
  payment: number  // Pago realizado
  balance: number  // Saldo acumulado (lo que debemos)
}

/**
 * Calcula los movimientos de cuenta corriente de proveedor ordenados cronológicamente
 * con saldo acumulado paso a paso.
 */
export function buildSupplierStatement(movements: SupplierMovement[]): SupplierStatementRow[] {
  let runningBalance = 0
  return [...movements]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => {
      const amount = Math.abs(Number(m.amount) || 0)
      const isCharge = m.type === 'purchase' || m.type === 'debit_note'
      const isPayment = m.type === 'payment' || m.type === 'credit_note'

      const charge = isCharge ? amount : 0
      const payment = isPayment ? amount : 0

      if (isCharge) {
        runningBalance = Math.round((runningBalance + amount) * 100) / 100
      } else if (isPayment) {
        runningBalance = Math.round((runningBalance - amount) * 100) / 100
      }

      const concept = m.note?.trim() || (m.type === 'purchase' ? 'Compra de mercadería' : m.type === 'payment' ? 'Pago a proveedor' : 'Ajuste de cuenta')

      return {
        date: m.created_at,
        type: m.type,
        concept,
        documentRef: m.document_ref,
        dueDate: m.due_date,
        charge,
        payment,
        balance: runningBalance,
      }
    })
}

export interface SupplierDebtSummary {
  totalDebt: number
  overdueDebt: number
  dueSoonDebt: number
  nextDueDate: string | null
  hasOverdue: boolean
}

/**
 * Analiza el estado de deuda con un proveedor:
 * Cuánto se le debe, cuánto está vencido y qué vence próximamente (próximos 7 días).
 */
export function calculateSupplierDebtSummary(
  movements: SupplierMovement[],
  currentDate: Date = new Date()
): SupplierDebtSummary {
  const statement = buildSupplierStatement(movements)
  const totalDebt = statement.length > 0 ? statement[statement.length - 1].balance : 0

  const todayStr = currentDate.toISOString().slice(0, 10)
  const in7Days = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let overdueDebt = 0
  let dueSoonDebt = 0
  let nextDueDate: string | null = null

  // Movimientos de compra pendientes
  for (const m of movements) {
    if (m.type === 'purchase' && m.due_date) {
      if (m.due_date < todayStr) {
        overdueDebt += Number(m.amount) || 0
      } else if (m.due_date <= in7Days) {
        dueSoonDebt += Number(m.amount) || 0
      }

      if (m.due_date >= todayStr) {
        if (!nextDueDate || m.due_date < nextDueDate) {
          nextDueDate = m.due_date
        }
      }
    }
  }

  // Acotar deuda vencida al total real adeudado
  overdueDebt = Math.min(overdueDebt, totalDebt)
  dueSoonDebt = Math.min(dueSoonDebt, Math.max(0, totalDebt - overdueDebt))

  return {
    totalDebt: Math.max(0, totalDebt),
    overdueDebt: Math.max(0, overdueDebt),
    dueSoonDebt: Math.max(0, dueSoonDebt),
    nextDueDate,
    hasOverdue: overdueDebt > 0,
  }
}


// Calificación de crédito de clientes en cuenta corriente.
// La deuda actual (customers.balance) se asigna a los cargos más recientes; la antigüedad
// del cargo impago más viejo define la nota. Superar el límite de crédito baja un escalón.

export type CreditGrade = 'A' | 'B' | 'C' | 'D'

export interface ChargeLite {
  amount: number
  created_at: string
}

export interface CreditScore {
  grade: CreditGrade
  label: string
  oldestUnpaidDays: number
  overLimit: boolean
}

const GRADE_LABELS: Record<CreditGrade, string> = {
  A: 'Buen pagador',
  B: 'Atraso leve',
  C: 'Atrasado',
  D: 'Deuda vieja',
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Días desde el cargo impago más antiguo, asumiendo que los pagos cancelan primero lo más viejo. */
export function oldestUnpaidDays(balance: number, charges: ChargeLite[], now: Date = new Date()): number {
  if (balance <= 0.009) return 0
  const newestFirst = [...charges].sort((a, b) => b.created_at.localeCompare(a.created_at))
  let remaining = balance
  let oldestDate: string | null = null
  for (const charge of newestFirst) {
    if (charge.amount <= 0) continue
    oldestDate = charge.created_at
    remaining -= charge.amount
    if (remaining <= 0.009) break
  }
  // Deuda sin cargos registrados (saldo inicial cargado a mano): se toma como vieja.
  if (!oldestDate || remaining > 0.009) return 365
  return Math.max(0, Math.floor((now.getTime() - new Date(oldestDate).getTime()) / DAY_MS))
}

export function creditScore(input: { balance: number; creditLimit: number; charges: ChargeLite[]; now?: Date }): CreditScore {
  const days = oldestUnpaidDays(input.balance, input.charges, input.now)
  const order: CreditGrade[] = ['A', 'B', 'C', 'D']
  let index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
  const overLimit = input.creditLimit > 0 && input.balance > input.creditLimit + 0.009
  if (overLimit) index = Math.min(3, index + 1)
  const grade = order[index]
  return { grade, label: GRADE_LABELS[grade], oldestUnpaidDays: days, overLimit }
}

/** ¿Una venta a cuenta por `amount` supera el límite? (límite 0 = sin límite). */
export function exceedsCreditLimit(balance: number, creditLimit: number, amount: number): boolean {
  return creditLimit > 0 && balance + amount > creditLimit + 0.009
}

export const GRADE_STYLES: Record<CreditGrade, string> = {
  A: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  B: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
  C: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  D: 'bg-red-500/10 text-red-400 border-red-500/25',
}

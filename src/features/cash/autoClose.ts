import { syncEngine } from '@/sync/syncEngine'
import { getLocalRows } from '@/sync/storage'
import type { CashMovement, CashSession } from '@/types/database'

/**
 * Primer horario de cierre automático (HH:MM) posterior a la apertura, si ya pasó.
 * Si el equipo estuvo apagado, la caja se cierra con la fecha y hora programadas.
 */
export function autoCloseDue(openedAt: Date, time: string, now: Date): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const due = new Date(openedAt)
  due.setHours(Number(match[1]), Number(match[2]), 0, 0)
  if (due <= openedAt) due.setDate(due.getDate() + 1)
  return due <= now ? due : null
}

export function expectedCash(session: Pick<CashSession, 'opening_amount'>, movements: Pick<CashMovement, 'type' | 'amount'>[]): number {
  const total = movements.reduce((sum, m) => sum + (m.type === 'withdrawal' ? -1 : 1) * (Number(m.amount) || 0), 0)
  return Math.round(((Number(session.opening_amount) || 0) + total) * 100) / 100
}

/** Cierra la caja abierta si ya pasó la hora programada. Devuelve true si cerró. */
export async function runCashAutoClose(businessId: string, userId: string, time: string | null | undefined): Promise<boolean> {
  if (!time) return false
  const sessions = await getLocalRows<CashSession>('cash_sessions', businessId)
  const open = sessions.find((s) => s.status === 'open')
  if (!open) return false
  const due = autoCloseDue(new Date(open.opened_at), time, new Date())
  if (!due) return false
  const movements = (await getLocalRows<CashMovement>('cash_movements', businessId)).filter((m) => m.session_id === open.id)
  const expected = expectedCash(open, movements)
  await syncEngine.updateRow('cash_sessions', businessId, open.id, {
    closing_amount: expected,
    expected_amount: expected,
    difference: 0,
    closed_by: userId,
    closed_at: due.toISOString(),
    status: 'closed',
    notes: `Cierre automático de las ${time} (sin recuento)`,
  })
  return true
}

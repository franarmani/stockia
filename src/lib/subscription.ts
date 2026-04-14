import { addMonths, differenceInDays, isAfter, isBefore } from 'date-fns'

/**
 * Calcula los días restantes de una suscripción.
 * Si el plan está activo y la fecha ya pasó, asume un rollover mensual automático
 * para mostrar los días restantes hasta el próximo ciclo.
 */
export function calculateRemainingDays(trialEndsAt: string | null | undefined, status: string): number {
  if (!trialEndsAt) return 30 // Fallback si no hay fecha definida

  const now = new Date()
  let expirationDate = new Date(trialEndsAt)

  // Si el plan está activo y la fecha ya pasó, calculamos el próximo rollover mensual
  if (status === 'active' && isBefore(expirationDate, now)) {
    while (isBefore(expirationDate, now)) {
      expirationDate = addMonths(expirationDate, 1)
    }
  }

  const diff = differenceInDays(expirationDate, now)
  return Math.max(0, diff)
}

/**
 * Determina si la suscripción está vigente o necesita atención
 */
export function getSubscriptionStatusLabel(trialEndsAt: string | null | undefined, status: string): string {
  const days = calculateRemainingDays(trialEndsAt, status)
  
  if (status === 'expired') return 'Vencido'
  if (status === 'trial' && days === 0) return 'Prueba Vencida'
  if (status === 'trial') return 'En Prueba'
  if (status === 'active') return 'Vigente'
  
  return 'Inactivo'
}

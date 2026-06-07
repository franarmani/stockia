import { getSubscriptionDateState, calculateRawRemainingDays } from '@/features/subscription/utils/subscriptionDates'

export function calculateRemainingDays(trialEndsAt: string | null | undefined, _status: string): number {
  return calculateRawRemainingDays(trialEndsAt)
}

export function getSubscriptionStatusLabel(trialEndsAt: string | null | undefined, status: string): string {
  const days = calculateRemainingDays(trialEndsAt, status)

  if (status === 'expired') return 'Vencido'
  if (status === 'trial' && days === 0) return 'Prueba Vencida'
  if (status === 'trial') return 'En Prueba'

  const state = trialEndsAt ? getSubscriptionDateState(trialEndsAt) : null
  if (state?.isExpired) return 'Vencido'
  if (status === 'active') return 'Vigente'

  return 'Inactivo'
}

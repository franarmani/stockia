import { useBusinessStore } from '@/stores/businessStore'
import { getSubscriptionDateState, getDaysSinceExpiration, formatSubscriptionDate } from '../utils/subscriptionDates'
import type { SubscriptionDateState, SubscriptionBannerState } from '../types/subscription.types'

export function useSubscription() {
  const { business, loading } = useBusinessStore()

  const trialEndsAt = business?.trial_ends_at
  const status = business?.subscription_status ?? 'trialing'
  const plan = business?.plan ?? 'free'

  // Source of truth: subscription_status from DB
  // 'active' → never expired, regardless of trial_ends_at
  // 'trial' → compute from trial_ends_at
  // 'expired' → always expired
  const isActive = status === 'active'
  const isEffectivelyExpired = status === 'expired'

  let dateState: SubscriptionDateState = {
    daysRemaining: 0,
    daysElapsed: 0,
    totalDays: 30,
    isExpired: false,
    expiresToday: false,
    expirationDate: new Date(),
  }

  if (trialEndsAt) {
    dateState = getSubscriptionDateState(trialEndsAt)
  } else if (!isActive) {
    dateState.isExpired = true
  }

  const planName = plan === 'vip' ? 'Plan Negocio' : 'Plan Inicial'
  const daysSinceExpired = !isActive ? getDaysSinceExpiration(trialEndsAt) : 0

  function getBannerState(): SubscriptionBannerState | null {
    if (isActive) return null
    if (status === 'cancelled') return null
    if (loading) return { variant: 'loading', daysRemaining: 0, endDate: new Date(), message: '', actionLabel: '', actionPath: '' }

    if (isEffectivelyExpired || dateState.isExpired) {
      return {
        variant: 'expired',
        daysRemaining: 0,
        endDate: dateState.expirationDate,
        message: trialEndsAt
          ? `Tu suscripción está vencida desde el ${formatSubscriptionDate(trialEndsAt)}. Para continuar usando Stockia, regularizá el pago del Plan Negocio.`
          : 'Tu suscripción se encuentra vencida. Para continuar usando Stockia, regularizá el pago del Plan Negocio.',
        actionLabel: 'Informar pago',
        actionPath: '/settings',
      }
    }

    if (dateState.expiresToday) {
      return {
        variant: 'expires_today',
        daysRemaining: 0,
        endDate: dateState.expirationDate,
        message: 'Tu suscripción vence hoy. Realizá el pago para mantener activo tu Plan Negocio.',
        actionLabel: 'Renovar plan',
        actionPath: '/settings',
      }
    }

    if (dateState.daysRemaining <= 3 && dateState.daysRemaining > 0) {
      return {
        variant: 'urgent',
        daysRemaining: dateState.daysRemaining,
        endDate: dateState.expirationDate,
        message: `Tu suscripción vence en ${dateState.daysRemaining} ${dateState.daysRemaining === 1 ? 'día' : 'días'}. Recordá realizar el pago para evitar interrupciones en el servicio.`,
        actionLabel: 'Renovar plan',
        actionPath: '/settings',
      }
    }

    if (dateState.daysRemaining <= 7) {
      return {
        variant: 'soon',
        daysRemaining: dateState.daysRemaining,
        endDate: dateState.expirationDate,
        message: `Tu Plan Negocio vence en ${dateState.daysRemaining} ${dateState.daysRemaining === 1 ? 'día' : 'días'}. Renová tu suscripción para continuar usando todas las funciones.`,
        actionLabel: 'Ver datos de renovación',
        actionPath: '/settings',
      }
    }

    return null
  }

  return {
    subscription: business,
    dateState,
    daysRemaining: dateState.daysRemaining,
    daysElapsed: dateState.daysElapsed,
    totalDays: dateState.totalDays,
    isExpired: !isActive && dateState.isExpired,
    expiresToday: !isActive && dateState.expiresToday,
    daysSinceExpired,
    planName,
    plan,
    status,
    isLoading: loading,
    bannerState: getBannerState(),
  }
}


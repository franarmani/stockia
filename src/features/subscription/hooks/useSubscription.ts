import { addDays } from 'date-fns'
import { getPlanById } from '@/config/plans'
import { useBusinessStore } from '@/stores/businessStore'
import { getSubscriptionDateState, getDaysSinceExpiration, formatSubscriptionDate, isSubscriptionExpired, trustedNow } from '../utils/subscriptionDates'
import { getBusinessVerifiedAt } from '@/lib/sessionCache'

const GRACE_DAYS = 3
const MAX_OFFLINE_DAYS = 7
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
  // 'active' vale hasta la fecha pagada más unos días de gracia, igual que en el servidor
  // (business_is_active). Sin fecha no vence: eso solo lo puede poner el superadmin.
  const paidLapsed = status === 'active' && !!trialEndsAt &&
    isSubscriptionExpired(addDays(new Date(trialEndsAt), GRACE_DAYS).toISOString())

  // Sin conexión se puede trabajar, pero no indefinidamente sin confirmar el pago con el servidor.
  const verifiedAt = getBusinessVerifiedAt()
  const needsOnlineCheck = !!business && verifiedAt !== null && trustedNow() - verifiedAt > MAX_OFFLINE_DAYS * 86400000

  const isActive = status === 'active' && !paidLapsed && !needsOnlineCheck
  const isEffectivelyExpired = status === 'expired' || paidLapsed || needsOnlineCheck

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

  const planName = status === 'trial' ? 'Prueba Premium' : `Plan ${getPlanById(plan).name}`
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
        message: needsOnlineCheck
          ? `Hace más de ${MAX_OFFLINE_DAYS} días que CajaGo no se conecta. Conectate a internet para verificar tu suscripción.`
          : trialEndsAt
          ? `Tu suscripción está vencida desde el ${formatSubscriptionDate(trialEndsAt)}. Para continuar usando CajaGo, regularizá el pago de tu plan.`
          : 'Tu suscripción se encuentra vencida. Para continuar usando CajaGo, regularizá el pago de tu plan.',
        actionLabel: 'Informar pago',
        actionPath: '/settings',
      }
    }

    if (dateState.expiresToday) {
      return {
        variant: 'expires_today',
        daysRemaining: 0,
        endDate: dateState.expirationDate,
        message: 'Tu suscripción vence hoy. Realizá el pago para mantener activo tu plan.',
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
        message: `Tu plan vence en ${dateState.daysRemaining} ${dateState.daysRemaining === 1 ? 'día' : 'días'}. Renová tu suscripción para continuar usando todas las funciones.`,
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
    isExpired: needsOnlineCheck || (!isActive && dateState.isExpired),
    needsOnlineCheck,
    expiresToday: !isActive && dateState.expiresToday,
    daysSinceExpired,
    planName,
    plan,
    status,
    isLoading: loading,
    bannerState: getBannerState(),
  }
}


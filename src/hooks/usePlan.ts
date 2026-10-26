import { useBusinessStore } from '@/stores/businessStore'
import { normalizePlan, PLANS, type PremiumFeature } from '@/config/plans'

/** Sin hook, para código que corre fuera del render (cargas, servicios). */
export function hasPremiumAccess(business: { plan?: string | null; subscription_status?: string | null } | null | undefined): boolean {
  return normalizePlan(business?.plan) === 'premium' || business?.subscription_status === 'trial'
}

/** Plan del negocio. Durante la prueba gratis se usa todo Premium para que lo conozcan completo. */
export function usePlan() {
  const { business } = useBusinessStore()
  const plan = normalizePlan(business?.plan)
  const isTrial = business?.subscription_status === 'trial'
  const isPremium = hasPremiumAccess(business)

  return {
    plan,
    planInfo: PLANS[plan],
    isTrial,
    isPremium,
    hasFeature: (_feature: PremiumFeature) => isPremium,
  }
}

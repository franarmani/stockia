import { useBusinessStore } from '@/stores/businessStore'
import { FEATURE_PLAN, normalizePlan, PLAN_LIMITS, PLANS, planRank, type PlanId, type PremiumFeature } from '@/config/plans'

type BusinessPlanFields = { plan?: string | null; subscription_status?: string | null } | null | undefined

/** Plan con el que se habilitan las funciones. Durante la prueba gratis, todo (VIP). */
export function effectivePlan(business: BusinessPlanFields): PlanId {
  return business?.subscription_status === 'trial' ? 'vip' : normalizePlan(business?.plan)
}

/** Sin hook, para código que corre fuera del render (cargas, servicios). Premium o más. */
export function hasPremiumAccess(business: BusinessPlanFields): boolean {
  return planRank(effectivePlan(business)) >= planRank('premium')
}

/** Plan del negocio y qué habilita. */
export function usePlan() {
  const { business } = useBusinessStore()
  const plan = normalizePlan(business?.plan)
  const effective = effectivePlan(business)

  return {
    plan,
    planInfo: PLANS[plan],
    isTrial: business?.subscription_status === 'trial',
    isPremium: planRank(effective) >= planRank('premium'),
    isVip: effective === 'vip',
    limits: PLAN_LIMITS[effective],
    hasPlan: (required: PlanId) => planRank(effective) >= planRank(required),
    hasFeature: (feature: PremiumFeature) => planRank(effective) >= planRank(FEATURE_PLAN[feature]),
  }
}

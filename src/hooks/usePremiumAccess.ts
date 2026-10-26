import { usePlan } from './usePlan'

export function usePremiumAccess() {
  const { isPremium, plan } = usePlan()
  return { isPremium, plan }
}

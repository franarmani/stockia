import { useBusinessStore } from '@/stores/businessStore'

export function usePremiumAccess() {
  const { business } = useBusinessStore()
  
  // A tenant has full access if they have any paid plan (vip)
  const isPremium = business?.plan === 'vip' || business?.plan === 'premium'
  
  return {
    isPremium,
    plan: business?.plan || 'basic'
  }
}

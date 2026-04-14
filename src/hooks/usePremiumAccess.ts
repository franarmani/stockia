import { useBusinessStore } from '@/stores/businessStore'

export function usePremiumAccess() {
  const { business } = useBusinessStore()
  
  // A tenant is premium if their plan is 'premium' 
  // OR if it's currently a superadmin (for testing/maintenance)
  const isPremium = business?.plan === 'premium'
  
  return {
    isPremium,
    plan: business?.plan || 'basic'
  }
}

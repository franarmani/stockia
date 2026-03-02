import { create } from 'zustand'
import type { Business } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface BusinessState {
  business: Business | null
  loading: boolean
  fetchBusiness: (businessId: string) => Promise<void>
  updateBusiness: (updates: Partial<Business>) => Promise<void>
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  business: null,
  loading: false,
  fetchBusiness: async (businessId: string) => {
    if (!businessId) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()
    if (error) {
      console.warn('Error fetching business:', error.message)
      set({ loading: false })
      return
    }
    set({ business: data, loading: false })
  },
  updateBusiness: async (updates: Partial<Business>) => {
    const business = get().business
    if (!business) return
    const { data } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', business.id)
      .select()
      .single()
    if (data) set({ business: data })
  },
}))

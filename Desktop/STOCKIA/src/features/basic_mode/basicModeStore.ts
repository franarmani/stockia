import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

interface BasicModeState {
  basicMode: boolean
  setBasicMode: (val: boolean, businessId?: string) => Promise<void>
  loadFromBusiness: (businessId: string) => Promise<void>
}

export const useBasicModeStore = create<BasicModeState>()(
  persist(
    (set) => ({
      basicMode: false,

      setBasicMode: async (val: boolean, businessId?: string) => {
        set({ basicMode: val })
        if (businessId) {
          await supabase
            .from('businesses')
            .update({ basic_mode: val })
            .eq('id', businessId)
        }
      },

      loadFromBusiness: async (businessId: string) => {
        const { data } = await supabase
          .from('businesses')
          .select('basic_mode')
          .eq('id', businessId)
          .single()
        if (data) set({ basicMode: data.basic_mode ?? false })
      },
    }),
    { name: 'stockia-basic-mode' }
  )
)

/** Full module list — advanced modules hidden in basic mode */
export const BASIC_MODE_ALLOWED_HREFS = new Set([
  '/pos',
  '/products',
  '/cash-register',
  '/sales',
  '/customers',
  '/menu',
])

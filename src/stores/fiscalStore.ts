/**
 * STOCKIA – Fiscal Settings Store (Zustand)
 * Manages fiscal_settings state per business + environment
 */

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { FiscalSettings, FiscalEnv, CertStatus } from '@/types/database'

interface FiscalState {
  settings: FiscalSettings | null
  loading: boolean
  env: FiscalEnv
  setEnv: (env: FiscalEnv) => void
  fetchSettings: (businessId: string, env?: FiscalEnv) => Promise<void>
  upsertSettings: (businessId: string, data: Partial<FiscalSettings>) => Promise<void>
  updateCertStatus: (status: CertStatus) => void
}

export const useFiscalStore = create<FiscalState>((set, get) => ({
  settings: null,
  loading: false,
  env: 'homo',

  setEnv: (env) => set({ env }),

  fetchSettings: async (businessId, env) => {
    const currentEnv = env || get().env
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('business_id', businessId)
        .eq('env', currentEnv)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching fiscal settings:', error.message)
      }
      set({ settings: (data as unknown as FiscalSettings) ?? null, loading: false, env: currentEnv })
    } catch {
      set({ loading: false })
    }
  },

  upsertSettings: async (businessId, data) => {
    const currentEnv = get().env
    try {
      const { data: existing } = await supabase
        .from('fiscal_settings')
        .select('id')
        .eq('business_id', businessId)
        .eq('env', currentEnv)
        .maybeSingle()

      if (existing) {
        // Update
        const { data: updated, error } = await supabase
          .from('fiscal_settings')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('business_id', businessId)
          .eq('env', currentEnv)
          .select()
          .single()
        if (error) throw error
        set({ settings: updated as unknown as FiscalSettings })
      } else {
        // Insert
        const { data: inserted, error } = await supabase
          .from('fiscal_settings')
          .insert({
            business_id: businessId,
            env: currentEnv,
            cuit: data.cuit || '',
            razon_social: data.razon_social || '',
            domicilio: data.domicilio || '',
            iva_condition: data.iva_condition || 'monotributo',
            pto_vta: data.pto_vta || 1,
            cert_status: 'missing',
            ...data,
          })
          .select()
          .single()
        if (error) throw error
        set({ settings: inserted as unknown as FiscalSettings })
      }
    } catch (err) {
      console.error('Error upserting fiscal settings:', err)
      throw err
    }
  },

  updateCertStatus: (status) => {
    const s = get().settings
    if (s) set({ settings: { ...s, cert_status: status } })
  },
}))

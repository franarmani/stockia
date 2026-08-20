/**
 * STOCKIA HUB – Fiscal Settings Store (Zustand)
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

/**
 * El entorno elegido se recuerda: arrancaba siempre en 'homo', asi que un
 * negocio con el certificado en produccion no encontraba su configuracion y
 * el POS mostraba las facturas como no disponibles.
 */
const ENV_KEY = 'stockia_fiscal_env'

function loadEnv(): FiscalEnv {
  try {
    const v = localStorage.getItem(ENV_KEY)
    if (v === 'homo' || v === 'prod') return v
  } catch {}
  return 'homo'
}

export const useFiscalStore = create<FiscalState>((set, get) => ({
  settings: null,
  loading: false,
  env: loadEnv(),

  setEnv: (env) => {
    try { localStorage.setItem(ENV_KEY, env) } catch {}
    set({ env })
  },

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

      // Sin config en este entorno, probar el otro: el certificado puede estar
      // cargado en produccion mientras el store arranco en homologacion.
      if (!data) {
        const otherEnv: FiscalEnv = currentEnv === 'prod' ? 'homo' : 'prod'
        const { data: other } = await supabase
          .from('fiscal_settings')
          .select('*')
          .eq('business_id', businessId)
          .eq('env', otherEnv)
          .maybeSingle()
        if (other) {
          try { localStorage.setItem(ENV_KEY, otherEnv) } catch {}
          set({ settings: other as unknown as FiscalSettings, loading: false, env: otherEnv })
          return
        }
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

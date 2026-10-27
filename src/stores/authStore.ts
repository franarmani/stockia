import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { clearCachedOfflineUser } from '@/lib/sessionCache'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /** Entró con Google y todavía no tiene negocio: hay que completar los datos. */
  needsOnboarding: boolean
  setNeedsOnboarding: (value: boolean) => void
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  needsOnboarding: false,
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    // Primero: sin esto, un cierre de sesión sin conexión volvía a entrar solo.
    clearCachedOfflineUser()
    await supabase.auth.signOut()
    set({ user: null, profile: null, needsOnboarding: false })
  },
}))

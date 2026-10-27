import { create } from 'zustand'
import { useAuthStore } from '@/stores/authStore'

export const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', seller: 'Vendedor', seller_jr: 'Vendedor Jr' }

/** Pantallas que ve un Vendedor Jr (el resto del menú queda oculto). */
export const SELLER_JR_PATHS = ['/menu', '/pos', '/sales', '/cash-register', '/customers', '/products', '/ayuda']

export function isSellerJr(): boolean {
  return useAuthStore.getState().profile?.role === 'seller_jr'
}

interface ApprovalState {
  reason: string | null
  resolve: ((pin: string | null) => void) | null
  /** Devuelve el código verificado, o null si se canceló. */
  request: (reason: string) => Promise<string | null>
  finish: (pin: string | null) => void
}

export const useManagerApproval = create<ApprovalState>((set, get) => ({
  reason: null,
  resolve: null,
  request: (reason) => new Promise<string | null>((resolve) => {
    get().resolve?.(null)
    set({ reason, resolve })
  }),
  finish: (pin) => {
    get().resolve?.(pin)
    set({ reason: null, resolve: null })
  },
}))

/** El Vendedor Jr necesita el código de un encargado; el resto pasa directo. */
export async function requireManagerFor(reason: string): Promise<boolean> {
  if (!isSellerJr()) return true
  return (await useManagerApproval.getState().request(reason)) !== null
}

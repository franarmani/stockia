import { supabase } from '@/lib/supabase'

// Cobro con QR de Mercado Pago: todo pasa por la función mp-qr (los tokens del comercio
// nunca llegan a la app).

export interface MpQrStatus {
  connected: boolean
  nickname: string | null
  pos_ready: boolean
}

export type QrOrderState = 'pending' | 'paid' | 'canceled' | 'expired' | 'refunded'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mp-qr', { body })
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'No se pudo conectar con Mercado Pago')
  }
  return data as T
}

export const mpQr = {
  status: () => call<MpQrStatus>({ action: 'status' }),
  connectUrl: () => call<{ url: string }>({ action: 'connect_url' }),
  disconnect: () => call<{ connected: false }>({ action: 'disconnect' }),
  setupPos: (address: { street_name: string; street_number: string; city: string; state_name: string }) =>
    call<{ pos_ready: true }>({ action: 'setup_pos', ...address }),
  create: (input: { amount: number; reference: string; description: string }) =>
    call<{ order_id: string; qr_data: string; state: QrOrderState }>({ action: 'create', ...input }),
  check: (orderId: string) => call<{ state: QrOrderState; payment_id: string | null }>({ action: 'check', order_id: orderId }),
  cancel: (orderId: string) => call<{ state: QrOrderState }>({ action: 'cancel', order_id: orderId }),
}

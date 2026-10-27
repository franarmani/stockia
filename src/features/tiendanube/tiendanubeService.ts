import { supabase } from '@/lib/supabase'

// Tiendanube: todo pasa por la función tiendanube (el token de la tienda nunca llega a la app).

export interface TiendanubeOrder {
  tn_order_id: number
  order_number: string | null
  customer_name: string | null
  total: number
  created_at: string
  cancelled_at: string | null
  items: Array<{ product_id: string | null; name: string; quantity: number; price: number }>
}

export interface TiendanubeStatus {
  connected: boolean
  store_name: string | null
  store_id: number | null
  connected_at: string | null
  last_sync_at: string | null
  last_error: string | null
  linked: number
  pending_stock: number
  orders: TiendanubeOrder[]
}

export interface UnmatchedVariant {
  tn_product_id: number
  tn_variant_id: number
  name: string
  sku: string | null
  barcode: string | null
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('tiendanube', { body })
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'No se pudo conectar con Tiendanube')
  }
  return data as T
}

export const tiendanube = {
  status: () => call<TiendanubeStatus>({ action: 'status' }),
  connectUrl: () => call<{ url: string }>({ action: 'connect_url' }),
  sync: () => call<{ variants: number; linked: number; unmatched: UnmatchedVariant[]; unmatched_total: number }>({ action: 'sync' }),
  link: (variant: UnmatchedVariant, productId: string) =>
    call<{ ok: true }>({ action: 'link', tn_product_id: variant.tn_product_id, tn_variant_id: variant.tn_variant_id, product_id: productId }),
  disconnect: () => call<{ ok: true }>({ action: 'disconnect' }),
}

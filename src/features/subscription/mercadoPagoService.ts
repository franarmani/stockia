import { supabase } from '@/lib/supabase'
import { openExternal } from '@/desktop/openExternal'
import type { PlanId } from '@/config/plans'

// La suscripción se crea y consulta desde el servidor (función mp-subscription):
// el Access Token de Mercado Pago nunca llega a la app.

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mp-subscription', { body })
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'No se pudo conectar con Mercado Pago')
  }
  return data as T
}

/** Crea la suscripción y abre el checkout de Mercado Pago en el navegador. */
export async function startMercadoPagoSubscription(payerEmail: string, plan: PlanId): Promise<{ amount: number }> {
  const result = await call<{ init_point: string; amount: number }>({ action: 'create', payer_email: payerEmail, plan })
  if (!result.init_point) throw new Error('Mercado Pago no devolvió el link de pago')
  await openExternal(result.init_point)
  return { amount: result.amount }
}

/** Consulta a Mercado Pago el estado y los cobros, y los aplica al negocio. */
export function syncMercadoPagoSubscription() {
  return call<{ status: string | null; applied: number }>({ action: 'sync' })
}

/** Cambia el plan de una suscripción activa: el nuevo importe se cobra desde el próximo débito. */
export function changeMercadoPagoPlan(plan: PlanId) {
  return call<{ plan: PlanId; amount: number }>({ action: 'change_plan', plan })
}

export function cancelMercadoPagoSubscription() {
  return call<{ status: string }>({ action: 'cancel' })
}

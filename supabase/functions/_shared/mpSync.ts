import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MP_API, approvedChargeFrom, isUuid } from './mercadopago.ts'

export async function mpFetch(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) throw new Error('MP_ACCESS_TOKEN no está configurado')
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`
    throw new Error(`Mercado Pago: ${message}`)
  }
  return data
}

async function applyCharge(admin: SupabaseClient, businessId: string, preapprovalId: string, authorizedPayment: any) {
  const charge = approvedChargeFrom(authorizedPayment)
  if (!charge) return false
  const { data, error } = await admin.rpc('apply_mp_subscription_payment', {
    p_business_id: businessId,
    p_preapproval_id: preapprovalId,
    p_mp_payment_id: charge.paymentId,
    p_amount: charge.amount,
    p_paid_at: charge.paidAt,
  })
  if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
  return data === true
}

/**
 * Trae de Mercado Pago el estado real de una suscripción y sus cobros, y lo aplica.
 * Es idempotente: se puede llamar desde el webhook y desde la app cuantas veces sea.
 */
export async function syncPreapproval(
  admin: SupabaseClient,
  preapprovalId: string,
  options: { authorizedPaymentId?: string } = {}
): Promise<{ businessId: string | null; status: string | null; applied: number }> {
  const preapproval = await mpFetch(`/preapproval/${encodeURIComponent(preapprovalId)}`)

  // Se busca por el id guardado al crear; external_reference (id del negocio) es el respaldo.
  let { data: business } = await admin.from('businesses').select('id').eq('mp_preapproval_id', preapproval.id).maybeSingle()
  if (!business && isUuid(preapproval.external_reference)) {
    ({ data: business } = await admin.from('businesses').select('id').eq('id', preapproval.external_reference).maybeSingle())
  }
  if (!business) return { businessId: null, status: preapproval.status ?? null, applied: 0 }

  await admin.from('businesses').update({
    mp_preapproval_id: preapproval.id,
    mp_subscription_status: preapproval.status ?? null,
    mp_next_payment_at: preapproval.next_payment_date ?? null,
  }).eq('id', business.id)

  let applied = 0
  if (options.authorizedPaymentId) {
    const authorizedPayment = await mpFetch(`/authorized_payments/${encodeURIComponent(options.authorizedPaymentId)}`)
    if (String(authorizedPayment.preapproval_id) === String(preapproval.id) && await applyCharge(admin, business.id, preapproval.id, authorizedPayment)) applied++
  }

  try {
    const search = await mpFetch(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapproval.id)}&limit=50`)
    for (const authorizedPayment of search?.results ?? []) {
      if (await applyCharge(admin, business.id, preapproval.id, authorizedPayment)) applied++
    }
  } catch (error) {
    console.warn('[mp-sync] no se pudieron listar los cobros de la suscripción:', error)
  }

  return { businessId: business.id, status: preapproval.status ?? null, applied }
}

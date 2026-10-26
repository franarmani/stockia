// Las funciones que usan la clave de servicio saltean RLS: el bloqueo por falta de pago se verifica acá,
// con la misma regla que las políticas de la base (business_is_active).

export const INACTIVE_MESSAGE = 'La suscripción de este negocio está vencida. Regularizá el pago para seguir usando CajaGo.'

// deno-lint-ignore no-explicit-any
export async function businessIsActive(client: any, businessId: string): Promise<boolean> {
  const { data, error } = await client.rpc('business_is_active', { p_business_id: businessId })
  return !error && data === true
}

/** Durante la prueba gratis se habilita todo, igual que en el programa (usePlan.effectivePlan). */
export function hasVipAccess(business: { plan?: string | null; subscription_status?: string | null } | null): boolean {
  return !!business && (business.plan === 'vip' || business.subscription_status === 'trial')
}

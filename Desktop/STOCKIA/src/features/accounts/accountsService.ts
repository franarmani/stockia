import { supabase } from '@/lib/supabase'
import type { CustomerAccount, AccountMovement } from '@/types/database'

export async function getOrCreateAccount(businessId: string, customerId: string): Promise<CustomerAccount> {
  const { data: existing } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (existing) return existing as CustomerAccount

  const { data, error } = await supabase
    .from('customer_accounts')
    .insert({ business_id: businessId, customer_id: customerId, credit_limit: 0, balance: 0 })
    .select()
    .single()

  if (error) throw error
  return data as CustomerAccount
}

export async function getAccountMovements(businessId: string, customerId: string): Promise<AccountMovement[]> {
  const { data, error } = await supabase
    .from('account_movements')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []) as AccountMovement[]
}

export async function applyPayment(
  businessId: string,
  customerId: string,
  amount: number,
  note?: string,
  userId?: string
): Promise<{ ok: boolean; new_balance: number }> {
  const { data, error } = await supabase.rpc('apply_account_payment', {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_amount: amount,
    p_note: note ?? null,
    p_user_id: userId ?? null,
  })
  if (error) throw error
  return data as { ok: boolean; new_balance: number }
}

export async function chargeAccount(
  businessId: string,
  customerId: string,
  amount: number,
  saleId?: string,
  userId?: string
): Promise<{ ok: boolean; new_balance: number }> {
  const { data, error } = await supabase.rpc('charge_customer_account', {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_amount: amount,
    p_sale_id: saleId ?? null,
    p_user_id: userId ?? null,
  })
  if (error) throw error
  return data as { ok: boolean; new_balance: number }
}

export async function updateCreditLimit(businessId: string, customerId: string, limit: number): Promise<void> {
  const { error } = await supabase
    .from('customer_accounts')
    .upsert({ business_id: businessId, customer_id: customerId, credit_limit: limit })
  if (error) throw error
}

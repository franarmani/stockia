import { supabase } from '@/lib/supabase'
import type { TopSellingProduct, FrequentlyBoughtTogether } from '@/types/database'

export async function fetchTopSellingProducts(
  businessId: string,
  days: 1 | 7 | 30 = 7,
  limit = 10
): Promise<TopSellingProduct[]> {
  const { data, error } = await supabase.rpc('top_selling_products', {
    p_business_id: businessId,
    p_days: days,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as TopSellingProduct[]
}

export async function fetchFrequentlyBoughtTogether(
  businessId: string,
  productId: string,
  limit = 3
): Promise<FrequentlyBoughtTogether[]> {
  const { data, error } = await supabase.rpc('frequently_bought_together', {
    p_business_id: businessId,
    p_product_id: productId,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as FrequentlyBoughtTogether[]
}

import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'

/**
 * Fetches all products for a business in batches to bypass the Supabase 1000 row limit.
 * It will continuously fetch batches of 1000 items until all active products are retrieved.
 */
export async function fetchAllProductsInBatches(businessId: string): Promise<Product[]> {
  let allProducts: Product[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name')
      .range(from, from + batchSize - 1)

    if (error) {
      console.error('Error fetching products in batches:', error)
      throw error
    }

    if (data && data.length > 0) {
      allProducts = allProducts.concat(data as Product[])
      if (data.length < batchSize) {
        hasMore = false
      } else {
        from += batchSize
      }
    } else {
      hasMore = false
    }
  }

  return allProducts
}

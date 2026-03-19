import { supabase } from '@/lib/supabase'
import type { StockInsight } from '@/types/database'

export async function fetchStockInsights(businessId: string): Promise<StockInsight[]> {
  const { data, error } = await supabase
    .from('stock_insights')
    .select('*')
    .eq('business_id', businessId)
    .order('stock_status', { ascending: false })

  if (error) throw error
  return (data ?? []) as StockInsight[]
}

export function computeDaysLeft(insight: StockInsight): number | null {
  if (!insight.avg_daily_sales_30d || insight.avg_daily_sales_30d <= 0) return null
  return insight.stock / insight.avg_daily_sales_30d
}

export function isDormant(insight: StockInsight, days = 45): boolean {
  if (!insight.last_sale_at) return insight.stock > 0
  const diff = (Date.now() - new Date(insight.last_sale_at).getTime()) / (1000 * 60 * 60 * 24)
  return diff > days
}

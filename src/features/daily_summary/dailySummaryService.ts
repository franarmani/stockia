import { supabase } from '@/lib/supabase'
import type { DailySummary } from '@/types/database'

export async function generateDailySummary(
  businessId: string,
  date?: string
): Promise<DailySummary & { payload: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc('generate_daily_summary', {
    p_business_id: businessId,
    p_date: date ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw error

  // Reload the row to get full record
  const { data: row, error: rowErr } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('business_id', businessId)
    .eq('date', date ?? new Date().toISOString().slice(0, 10))
    .single()

  if (rowErr) throw rowErr
  return row as DailySummary & { payload: Record<string, unknown> }
}

export async function getDailySummaries(businessId: string, limit = 30): Promise<DailySummary[]> {
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('business_id', businessId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as DailySummary[]
}

export function buildWhatsAppText(summary: DailySummary, businessName: string): string {
  const lines = [
    `📊 *Resumen ${summary.date} — ${businessName}*`,
    ``,
    `💰 Ventas: $${summary.total_sales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    `🛒 Cantidad: ${summary.sales_count} venta${summary.sales_count !== 1 ? 's' : ''}`,
    `📈 Ganancia est.: $${summary.total_profit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    summary.top_product_name ? `🥇 Más vendido: ${summary.top_product_name}` : '',
    summary.cash_opened_at ? `⏰ Caja abierta: ${new Date(summary.cash_opened_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '',
    summary.cash_closed_at ? `🔒 Caja cerrada: ${new Date(summary.cash_closed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '',
  ].filter(Boolean)

  if (Object.keys(summary.payment_breakdown ?? {}).length) {
    lines.push(``, `*Métodos de pago:*`)
    for (const [method, amount] of Object.entries(summary.payment_breakdown ?? {})) {
      lines.push(`• ${method}: $${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
    }
  }

  return encodeURIComponent(lines.join('\n'))
}

export function exportSummaryCSV(summary: DailySummary): void {
  const rows = [
    ['Fecha', summary.date],
    ['Total ventas', summary.total_sales],
    ['Cantidad ventas', summary.sales_count],
    ['Costo total', summary.total_cost],
    ['Ganancia estimada', summary.total_profit],
    ['Producto más vendido', summary.top_product_name ?? ''],
    ...Object.entries(summary.payment_breakdown ?? {}).map(([k, v]) => [`Pago - ${k}`, v]),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `resumen-${summary.date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

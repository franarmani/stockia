// Reporte mensual del negocio en PDF (A4): ventas, ganancia, comparación con el mes anterior,
// ventas por día, medios de pago, productos y categorías. Se arma en HTML y se descarga con html2pdf.
// @ts-ignore
import { savePdfFromHtml } from '@/lib/saveFile'
import { supabase } from '@/lib/supabase'
import { inlineImage } from '@/lib/documentLayout'
import { formatCurrency } from '@/lib/utils'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', debit: 'Débito', credit: 'Crédito', transfer: 'Transferencia',
  account: 'Cuenta corriente', qr: 'QR Mercado Pago', mixed: 'Mixto',
}
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

type SaleRow = {
  id: string; total: number; total_cost: number | null; total_profit: number | null; created_at: string
  payment_method: string; payment_method2: string | null; amount_method1: number | null; amount_method2: number | null
}
type ItemRow = { product_id: string; quantity: number; line_total: number | null; line_profit: number | null }

export interface MonthlyReportData {
  businessName: string
  year: number
  month: number
  sales: { total: number; count: number; cost: number; profit: number }
  previous: { total: number; count: number; profit: number }
  byDay: number[]
  byPayment: Array<{ label: string; amount: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number; profit: number }>
  byCategory: Array<{ name: string; revenue: number; profit: number }>
}

async function salesBetween(businessId: string, from: Date, to: Date): Promise<SaleRow[]> {
  const rows: SaleRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('sales')
      .select('id, total, total_cost, total_profit, created_at, payment_method, payment_method2, amount_method1, amount_method2')
      .eq('business_id', businessId).eq('voided', false)
      .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
      .order('created_at').range(offset, offset + 999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as unknown as SaleRow[]))
    if (!data || data.length < 1000) return rows
  }
}

async function itemsBetween(businessId: string, from: Date, to: Date): Promise<ItemRow[]> {
  const rows: ItemRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await (supabase as any).from('sale_items')
      .select('product_id, quantity, line_total, line_profit, sales!inner(business_id, created_at, voided)')
      .eq('sales.business_id', businessId).eq('sales.voided', false)
      .gte('sales.created_at', from.toISOString()).lt('sales.created_at', to.toISOString())
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

export async function loadMonthlyReport(businessId: string, businessName: string, year: number, month: number): Promise<MonthlyReportData> {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 1)
  const prevFrom = new Date(year, month - 1, 1)

  const [sales, previous, items, { data: products }, { data: categories }] = await Promise.all([
    salesBetween(businessId, from, to),
    salesBetween(businessId, prevFrom, from),
    itemsBetween(businessId, from, to),
    supabase.from('products').select('id, name, category_id').eq('business_id', businessId).limit(20000),
    supabase.from('categories').select('id, name').eq('business_id', businessId),
  ])

  const sum = (rows: SaleRow[], pick: (row: SaleRow) => number) => rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const byDay = Array(daysInMonth).fill(0)
  const payments = new Map<string, number>()
  for (const sale of sales) {
    byDay[new Date(sale.created_at).getDate() - 1] += Number(sale.total) || 0
    if (sale.payment_method2 && sale.amount_method2) {
      payments.set(sale.payment_method, (payments.get(sale.payment_method) ?? 0) + (Number(sale.amount_method1) || 0))
      payments.set(sale.payment_method2, (payments.get(sale.payment_method2) ?? 0) + (Number(sale.amount_method2) || 0))
    } else {
      payments.set(sale.payment_method, (payments.get(sale.payment_method) ?? 0) + (Number(sale.total) || 0))
    }
  }

  const productInfo = new Map((products ?? []).map(p => [p.id, p]))
  const categoryName = new Map((categories ?? []).map(c => [c.id, c.name]))
  const byProduct = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>()
  const byCategory = new Map<string, { name: string; revenue: number; profit: number }>()
  for (const item of items) {
    const product = productInfo.get(item.product_id)
    const entry = byProduct.get(item.product_id) ?? { name: product?.name ?? 'Producto eliminado', quantity: 0, revenue: 0, profit: 0 }
    entry.quantity += Number(item.quantity) || 0
    entry.revenue += Number(item.line_total) || 0
    entry.profit += Number(item.line_profit) || 0
    byProduct.set(item.product_id, entry)
    const catName = (product?.category_id && categoryName.get(product.category_id)) || 'Sin categoría'
    const cat = byCategory.get(catName) ?? { name: catName, revenue: 0, profit: 0 }
    cat.revenue += Number(item.line_total) || 0
    cat.profit += Number(item.line_profit) || 0
    byCategory.set(catName, cat)
  }

  return {
    businessName, year, month,
    sales: { total: sum(sales, s => s.total), count: sales.length, cost: sum(sales, s => s.total_cost ?? 0), profit: sum(sales, s => s.total_profit ?? 0) },
    previous: { total: sum(previous, s => s.total), count: previous.length, profit: sum(previous, s => s.total_profit ?? 0) },
    byDay,
    byPayment: [...payments.entries()].map(([key, amount]) => ({ label: PAYMENT_LABELS[key] ?? key, amount })).sort((a, b) => b.amount - a.amount),
    topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 12),
    byCategory: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  }
}

const esc = (text: string) => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
const pct = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

function change(current: number, previous: number): string {
  if (!previous) return '<span class="muted">sin datos del mes anterior</span>'
  const diff = ((current - previous) / Math.abs(previous)) * 100
  return `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${pct(Math.abs(diff))}</span> <span class="muted">vs. mes anterior</span>`
}

function dailyChart(byDay: number[]): string {
  const width = 690, height = 170, max = Math.max(...byDay, 1)
  const step = width / byDay.length, bar = Math.max(4, step * 0.62)
  const bars = byDay.map((value, i) => {
    const h = Math.round((value / max) * (height - 24))
    return `<rect x="${(i * step + (step - bar) / 2).toFixed(1)}" y="${height - 16 - h}" width="${bar.toFixed(1)}" height="${h}" rx="2" fill="${value === max && value > 0 ? '#6178ee' : '#c7d0fb'}"/>`
      + ((i + 1) % 5 === 0 || i === 0 ? `<text x="${(i * step + step / 2).toFixed(1)}" y="${height - 2}" font-size="9" text-anchor="middle" fill="#8a94a6">${i + 1}</text>` : '')
  }).join('')
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`
}

export async function buildMonthlyReportHtml(data: MonthlyReportData): Promise<string> {
  const icon = await inlineImage('/cajago-icon.png')
  const period = `${MONTHS[data.month][0].toUpperCase()}${MONTHS[data.month].slice(1)} ${data.year}`
  const margin = data.sales.total ? (data.sales.profit / data.sales.total) * 100 : 0
  const ticket = data.sales.count ? data.sales.total / data.sales.count : 0
  const bestDay = data.byDay.indexOf(Math.max(...data.byDay))
  const paymentsTotal = data.byPayment.reduce((acc, p) => acc + p.amount, 0) || 1

  const kpi = (label: string, value: string, extra: string) => `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p><p class="kpi-extra">${extra}</p></div>`
  const empty = '<p class="muted small">Sin ventas registradas en el período.</p>'

  return `
<div class="sheet">
  <style>
    .sheet { width: 794px; font-family: 'Manrope', 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; }
    .head { background: #0b0e13; color: #fff; padding: 26px 40px; display: flex; align-items: center; justify-content: space-between; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .brand img { width: 34px; height: 34px; }
    .brand b { color: #9aa9ff; }
    .head-right { text-align: right; }
    .head-right p { margin: 0; }
    .title { font-size: 11px; color: #9aa9ff; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
    .period { font-size: 22px; font-weight: 800; margin-top: 2px !important; }
    .biz { font-size: 12px; color: #aeb6c6; margin-top: 2px !important; }
    .body { padding: 28px 40px 18px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .kpi { border: 1px solid #e5e8ef; border-radius: 10px; padding: 12px 14px; }
    .kpi-label { margin: 0; font-size: 10.5px; color: #6b7385; font-weight: 600; }
    .kpi-value { margin: 4px 0 2px; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
    .kpi-extra { margin: 0; font-size: 10px; }
    h2 { font-size: 13px; font-weight: 800; margin: 24px 0 10px; letter-spacing: -0.01em; }
    .section { page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-weight: 700; color: #6b7385; font-size: 10px; padding: 7px 8px; border-bottom: 1px solid #e5e8ef; }
    td { padding: 7px 8px; border-bottom: 1px solid #f0f2f6; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .bar { height: 6px; background: #eef1fe; border-radius: 4px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: #6178ee; border-radius: 4px; }
    .up { color: #059669; font-weight: 700; } .down { color: #dc2626; font-weight: 700; }
    .muted { color: #8a94a6; } .small { font-size: 11px; }
    .note { margin-top: 6px; font-size: 10.5px; color: #6b7385; }
    .foot { margin: 18px 40px 26px; padding-top: 10px; border-top: 1px solid #e5e8ef; display: flex; justify-content: space-between; font-size: 9.5px; color: #8a94a6; }
  </style>

  <div class="head">
    <div class="brand">${icon ? `<img src="${icon}" alt="">` : ''}<span>Caja<b>Go</b></span></div>
    <div class="head-right">
      <p class="title">Reporte mensual</p>
      <p class="period">${period}</p>
      <p class="biz">${esc(data.businessName)}</p>
    </div>
  </div>

  <div class="body">
    <div class="kpis">
      ${kpi('Ventas totales', formatCurrency(data.sales.total), change(data.sales.total, data.previous.total))}
      ${kpi('Ganancia bruta', formatCurrency(data.sales.profit), change(data.sales.profit, data.previous.profit))}
      ${kpi('Margen', pct(margin), `<span class="muted">costo ${formatCurrency(data.sales.cost)}</span>`)}
      ${kpi('Operaciones', String(data.sales.count), `<span class="muted">ticket promedio ${formatCurrency(ticket)}</span>`)}
    </div>

    <div class="section">
      <h2>Ventas por día</h2>
      ${data.sales.count ? dailyChart(data.byDay) + `<p class="note">Mejor día: ${bestDay + 1} de ${MONTHS[data.month]} con ${formatCurrency(data.byDay[bestDay])}.</p>` : empty}
    </div>

    <div class="section">
      <h2>Medios de pago</h2>
      ${data.byPayment.length ? `<table><thead><tr><th>Medio</th><th style="width:45%"></th><th class="num">Monto</th><th class="num">%</th></tr></thead><tbody>
        ${data.byPayment.map(p => `<tr><td>${esc(p.label)}</td><td><div class="bar"><span style="width:${(p.amount / paymentsTotal) * 100}%"></span></div></td><td class="num">${formatCurrency(p.amount)}</td><td class="num">${pct((p.amount / paymentsTotal) * 100)}</td></tr>`).join('')}
      </tbody></table>` : empty}
    </div>

    <div class="section">
      <h2>Productos más vendidos</h2>
      ${data.topProducts.length ? `<table><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Ventas</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead><tbody>
        ${data.topProducts.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${p.quantity.toLocaleString('es-AR')}</td><td class="num">${formatCurrency(p.revenue)}</td><td class="num">${formatCurrency(p.profit)}</td><td class="num">${p.revenue ? pct((p.profit / p.revenue) * 100) : '—'}</td></tr>`).join('')}
      </tbody></table>` : empty}
    </div>

    <div class="section">
      <h2>Por categoría</h2>
      ${data.byCategory.length ? `<table><thead><tr><th>Categoría</th><th class="num">Ventas</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead><tbody>
        ${data.byCategory.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${formatCurrency(c.revenue)}</td><td class="num">${formatCurrency(c.profit)}</td><td class="num">${c.revenue ? pct((c.profit / c.revenue) * 100) : '—'}</td></tr>`).join('')}
      </tbody></table>` : empty}
    </div>
  </div>

  <div class="foot">
    <span>Generado con CajaGo el ${new Date().toLocaleString('es-AR')}</span>
    <span>La ganancia se calcula con el costo cargado de cada producto al momento de la venta.</span>
  </div>
</div>`
}

export async function downloadMonthlyReport(data: MonthlyReportData) {
  const html = await buildMonthlyReportHtml(data)
  const name = data.businessName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Negocio'
  await savePdfFromHtml(html, `Reporte_${name}_${data.year}-${String(data.month + 1).padStart(2, '0')}.pdf`, { avoid: '.section' })
}

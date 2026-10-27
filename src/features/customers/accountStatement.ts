// Estado de cuenta corriente de un cliente: movimientos con saldo acumulado, en PDF (A4) o Excel.
// @ts-ignore
import { saveBlob, savePdfFromHtml } from '@/lib/saveFile'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { inlineImage } from '@/lib/documentLayout'
import { formatCurrency } from '@/lib/utils'
import { toArrayBuffer, triggerDownload } from '@/lib/import/exportWriter'
import type { AccountMovement } from '@/types/database'

export interface StatementRow { date: string; concept: string; charge: number; payment: number; balance: number }

const esc = (text: string) => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))

/** Ordena de más viejo a más nuevo y calcula el saldo después de cada movimiento. */
export function buildStatement(movements: Pick<AccountMovement, 'type' | 'amount' | 'note' | 'created_at' | 'sale_id'>[]): StatementRow[] {
  let balance = 0
  return [...movements]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => {
      const amount = Number(m.amount) || 0
      const charge = m.type === 'payment' ? 0 : Math.max(amount, 0)
      const payment = m.type === 'payment' ? Math.abs(amount) : Math.max(-amount, 0)
      balance = Math.round((balance + charge - payment) * 100) / 100
      const concept = m.note?.trim() || (m.type === 'payment' ? 'Pago' : m.sale_id ? 'Compra a cuenta' : 'Ajuste')
      return { date: m.created_at, concept, charge, payment, balance }
    })
}

export async function loadStatement(businessId: string, customerId: string): Promise<StatementRow[]> {
  const { data, error } = await (supabase as any).from('account_movements')
    .select('type, amount, note, created_at, sale_id')
    .eq('business_id', businessId).eq('customer_id', customerId)
    .order('created_at', { ascending: true }).limit(5000)
  if (error) throw error
  return buildStatement(data ?? [])
}

const fileName = (customer: string, ext: string) =>
  `Cuenta_${customer.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'cliente'}_${new Date().toISOString().slice(0, 10)}.${ext}`

export function downloadStatementExcel(customer: string, rows: StatementRow[], currentBalance: number) {
  const sheet = XLSX.utils.json_to_sheet(rows.map((r) => ({
    Fecha: new Date(r.date).toLocaleString('es-AR'),
    Concepto: r.concept,
    Cargo: r.charge || '',
    Pago: r.payment || '',
    Saldo: r.balance,
  })))
  XLSX.utils.sheet_add_aoa(sheet, [[], ['', 'Saldo actual', '', '', currentBalance]], { origin: -1 })
  sheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Cuenta corriente')
  const buf = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  triggerDownload(new Blob([toArrayBuffer(buf)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(customer, 'xlsx'))
}

export async function downloadStatementPdf(businessName: string, customer: string, rows: StatementRow[], currentBalance: number) {
  const icon = await inlineImage('/cajago-icon.png')
  const charges = rows.reduce((s, r) => s + r.charge, 0)
  const payments = rows.reduce((s, r) => s + r.payment, 0)
  const html = `
<div class="sheet">
  <style>
    .sheet { width: 794px; font-family: 'Manrope', 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; }
    .head { background: #0b0e13; color: #fff; padding: 26px 40px; display: flex; align-items: center; justify-content: space-between; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 800; }
    .brand img { width: 34px; height: 34px; } .brand b { color: #9aa9ff; }
    .head-right { text-align: right; } .head-right p { margin: 0; }
    .title { font-size: 11px; color: #9aa9ff; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
    .customer { font-size: 22px; font-weight: 800; margin-top: 2px !important; }
    .biz { font-size: 12px; color: #aeb6c6; margin-top: 2px !important; }
    .body { padding: 28px 40px 18px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi { border: 1px solid #e5e8ef; border-radius: 10px; padding: 12px 14px; }
    .kpi p { margin: 0; } .kpi-label { font-size: 10.5px; color: #6b7385; font-weight: 600; }
    .kpi-value { margin-top: 4px !important; font-size: 18px; font-weight: 800; }
    .debt { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-weight: 700; color: #6b7385; font-size: 10px; padding: 7px 8px; border-bottom: 1px solid #e5e8ef; }
    td { padding: 7px 8px; border-bottom: 1px solid #f0f2f6; }
    tr { page-break-inside: avoid; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .muted { color: #8a94a6; }
    .foot { margin: 18px 40px 26px; padding-top: 10px; border-top: 1px solid #e5e8ef; font-size: 9.5px; color: #8a94a6; }
  </style>
  <div class="head">
    <div class="brand">${icon ? `<img src="${icon}" alt="">` : ''}<span>Caja<b>Go</b></span></div>
    <div class="head-right">
      <p class="title">Estado de cuenta corriente</p>
      <p class="customer">${esc(customer)}</p>
      <p class="biz">${esc(businessName)} · al ${new Date().toLocaleDateString('es-AR')}</p>
    </div>
  </div>
  <div class="body">
    <div class="kpis">
      <div class="kpi"><p class="kpi-label">Compras a cuenta</p><p class="kpi-value">${formatCurrency(charges)}</p></div>
      <div class="kpi"><p class="kpi-label">Pagos</p><p class="kpi-value">${formatCurrency(payments)}</p></div>
      <div class="kpi"><p class="kpi-label">Saldo actual</p><p class="kpi-value ${currentBalance > 0 ? 'debt' : ''}">${formatCurrency(currentBalance)}</p></div>
    </div>
    ${rows.length ? `<table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Cargo</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="muted">${new Date(r.date).toLocaleDateString('es-AR')}</td><td>${esc(r.concept)}</td><td class="num">${r.charge ? formatCurrency(r.charge) : ''}</td><td class="num">${r.payment ? formatCurrency(r.payment) : ''}</td><td class="num">${formatCurrency(r.balance)}</td></tr>`).join('')}
    </tbody></table>` : '<p class="muted">Sin movimientos en la cuenta corriente.</p>'}
  </div>
  <div class="foot">Generado con CajaGo el ${new Date().toLocaleString('es-AR')}</div>
</div>`
  await savePdfFromHtml(html, fileName(customer, 'pdf'))
}

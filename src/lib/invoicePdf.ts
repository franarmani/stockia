/**
 * Invoice PDF Generator – Creates Factura A/B/C PDF (A4)
 * Uses the browser's built-in print-to-PDF capability.
 *
 * Format follows AFIP regulation for electronic invoices:
 * - Header with business data + invoice type letter
 * - Customer data
 * - Items table
 * - IVA breakdown (Factura A)
 * - CAE + QR code area
 */

import { formatCurrency } from '@/lib/utils'
import { IVA_CONDITIONS, DOC_TIPOS, CBTE_TIPOS } from '@/types/database'
import type { CartItem } from '@/types/database'

export interface InvoicePDFData {
  // Business
  businessName: string
  businessCuit?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  ivaCondition?: string | null
  iibb?: string | null
  razonSocial?: string | null
  domicilioComercial?: string | null
  inicioActividades?: string | null

  // Invoice
  invoiceType: string   // 'A' | 'B' | 'C'
  invoiceNumber: number
  puntoVenta: number
  cae?: string | null
  caeExpiry?: string | null
  date: Date

  // Customer
  customerName: string
  customerDocTipo?: number
  customerDocNro?: string
  customerIvaCondition?: string
  customerAddress?: string

  // Items
  items: CartItem[]
  subtotal: number
  discount: number
  surchargeAmount: number
  total: number

  // IVA (for Factura A)
  netoGravado?: number
  ivaAmount?: number
  netoNoGravado?: number
  exento?: number

  // Payment
  paymentMethod: string
  installments?: number

  // Branding
  logoUrl?: string | null
  primaryColor?: string
}

function pad(n: number, len: number) {
  return String(n).padStart(len, '0')
}

function getIvaLabel(id: string | null | undefined) {
  return IVA_CONDITIONS.find(c => c.id === id)?.label || id || '-'
}

function getDocLabel(docTipo: number | undefined) {
  return DOC_TIPOS.find(d => d.id === docTipo)?.label || 'Doc.'
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', debit: 'Tarjeta Débito', credit: 'Tarjeta Crédito',
  transfer: 'Transferencia', account: 'Cuenta Corriente', mixed: 'Pago mixto',
}

function getInvoiceLetter(type: string): string {
  return type.toUpperCase()
}

function getInvoiceColor(type: string): string {
  if (type === 'A') return '#1d4ed8'
  if (type === 'B') return '#1DB954'
  return '#7c3aed'
}

function buildAfipQrUrlPdf(data: InvoicePDFData): string | null {
  if (!data.cae || !data.businessCuit || !data.invoiceNumber || !data.puntoVenta) return null
  const cbteTipoMap: Record<string, number> = { A: 1, B: 6, C: 11 }
  const cbteTipo = cbteTipoMap[data.invoiceType]
  if (!cbteTipo) return null
  const qrData = {
    ver: 1,
    fecha: data.date.toISOString().slice(0, 10),
    cuit: Number(data.businessCuit.replace(/[^0-9]/g, '')),
    ptoVta: data.puntoVenta,
    tipoCmp: cbteTipo,
    nroCmp: data.invoiceNumber,
    importe: data.total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: data.customerDocTipo || 99,
    nroDocRec: Number(data.customerDocNro?.replace(/[^0-9]/g, '') || '0'),
    tipoCodAut: 'E',
    codAut: Number(data.cae),
  }
  const base64 = btoa(JSON.stringify(qrData))
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

export function generateInvoicePDF(data: InvoicePDFData) {
  const letter = getInvoiceLetter(data.invoiceType)
  const color = data.primaryColor || getInvoiceColor(data.invoiceType)
  const isFacturaA = data.invoiceType === 'A'
  const fullNumber = `${pad(data.puntoVenta, 5)}-${pad(data.invoiceNumber, 8)}`

  const dateStr = data.date.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const itemsRows = data.items.map((item) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${item.product.name}${item.product.brand ? ` <span style="color:#9ca3af;font-size:11px;">(${item.product.brand})</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${letter} ${fullNumber}</title>
  <style>
    @page { margin: 15mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1f2937; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; position: relative; }
    .header-left { flex: 1; }
    .header-right { flex: 1; text-align: right; }
    .letter-box { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 56px; height: 56px; border: 3px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; color: ${color}; background: white; z-index: 1; }
    .biz-name { font-size: 18px; font-weight: 700; color: #111827; }
    .biz-detail { font-size: 11px; color: #6b7280; }
    .invoice-type { font-size: 16px; font-weight: 700; color: ${color}; }
    .invoice-number { font-size: 22px; font-weight: 800; color: #111827; margin-top: 2px; }
    .section { margin-top: 16px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 6px; }
    .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; }
    .customer-grid dt { color: #6b7280; }
    .customer-grid dd { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { background: #f9fafb; padding: 8px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
    .totals-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .total-row.main { font-size: 20px; font-weight: 800; color: ${color}; border-top: 2px solid ${color}; padding-top: 8px; margin-top: 4px; }
    .cae-section { margin-top: 20px; padding: 12px 16px; border: 2px solid ${color}; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .cae-label { font-size: 11px; color: #6b7280; }
    .cae-value { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: 0.05em; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:6px;display:block;" />` : ''}
      <p class="biz-name">${data.razonSocial || data.businessName}</p>
      <p class="biz-detail">${data.domicilioComercial || data.businessAddress || ''}</p>
      ${data.businessCuit ? `<p class="biz-detail">CUIT: ${data.businessCuit}</p>` : ''}
      <p class="biz-detail">Cond. IVA: ${getIvaLabel(data.ivaCondition)}</p>
      ${data.iibb ? `<p class="biz-detail">IIBB: ${data.iibb}</p>` : ''}
      ${data.inicioActividades ? `<p class="biz-detail">Inicio Act.: ${data.inicioActividades}</p>` : ''}
    </div>
    <div class="letter-box">${letter}</div>
    <div class="header-right">
      <p class="invoice-type">FACTURA</p>
      <p class="invoice-number">Nro. ${fullNumber}</p>
      <p class="biz-detail" style="margin-top:4px;">Fecha: ${dateStr}</p>
      <p class="biz-detail">Pto. Venta: ${pad(data.puntoVenta, 5)}</p>
    </div>
  </div>

  <!-- CUSTOMER -->
  <div class="section">
    <p class="section-title">Datos del cliente</p>
    <dl class="customer-grid">
      <dt>Nombre / Razón Social</dt>
      <dd>${data.customerName || 'Consumidor Final'}</dd>
      <dt>${getDocLabel(data.customerDocTipo)}</dt>
      <dd>${data.customerDocNro && data.customerDocNro !== '0' ? data.customerDocNro : '-'}</dd>
      <dt>Cond. IVA</dt>
      <dd>${getIvaLabel(data.customerIvaCondition)}</dd>
      ${data.customerAddress ? `<dt>Domicilio</dt><dd>${data.customerAddress}</dd>` : ''}
      <dt>Forma de pago</dt>
      <dd>${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}${data.installments && data.installments > 1 ? ` (${data.installments} cuotas)` : ''}</dd>
    </dl>
  </div>

  <!-- ITEMS -->
  <div class="section">
    <p class="section-title">Detalle</p>
    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th>Cant.</th>
          <th>P. Unitario</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals">
    <div class="totals-box">
      ${data.discount > 0 ? `
        <div class="total-row">
          <span>Descuento ${data.discount}%</span>
          <span>-${formatCurrency(data.subtotal * data.discount / 100)}</span>
        </div>
      ` : ''}
      ${data.surchargeAmount > 0 ? `
        <div class="total-row">
          <span>Recargo</span>
          <span>+${formatCurrency(data.surchargeAmount)}</span>
        </div>
      ` : ''}
      ${isFacturaA ? `
        <div class="total-row">
          <span>Neto gravado</span>
          <span>${formatCurrency(data.netoGravado || 0)}</span>
        </div>
        <div class="total-row">
          <span>IVA 21%</span>
          <span>${formatCurrency(data.ivaAmount || 0)}</span>
        </div>
      ` : ''}
      <div class="total-row main">
        <span>TOTAL</span>
        <span>${formatCurrency(data.total)}</span>
      </div>
    </div>
  </div>

  <!-- CAE -->
  ${data.cae ? `
  <div class="cae-section">
    <div>
      <p class="cae-label">CAE (Código de Autorización Electrónico)</p>
      <p class="cae-value">${data.cae}</p>
      <p class="cae-label" style="margin-top:4px;">Fecha Vto. CAE</p>
      <p style="font-size:14px;font-weight:700;">${data.caeExpiry || '-'}</p>
    </div>
    ${(() => {
      const qrUrl = buildAfipQrUrlPdf(data)
      return qrUrl ? `<div style="text-align:center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}" alt="QR AFIP" style="width:120px;height:120px;" />
        <p style="font-size:9px;color:#9ca3af;margin-top:2px;">Comprobante válido como factura</p>
      </div>` : `<div style="text-align:right;">
        <p class="cae-label">Fecha Vto. CAE</p>
        <p style="font-size:14px;font-weight:700;">${data.caeExpiry || '-'}</p>
      </div>`
    })()}
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <p>Comprobante electrónico emitido según RG AFIP ${isFacturaA ? '4291' : '4004'}</p>
  </div>

<script>
  window.onload = function() { window.print(); }
</script>
</body>
</html>`

  return html
}

/** Open invoice PDF in a new window for printing/saving */
export function openInvoicePDF(data: InvoicePDFData) {
  const html = generateInvoicePDF(data)
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

/** Generate a WhatsApp share link with invoice summary */
export function getWhatsAppLink(data: InvoicePDFData, phone?: string): string {
  const letter = getInvoiceLetter(data.invoiceType)
  const fullNumber = `${pad(data.puntoVenta, 5)}-${pad(data.invoiceNumber, 8)}`

  const lines = [
    `📄 *Factura ${letter} Nro. ${fullNumber}*`,
    `Fecha: ${data.date.toLocaleDateString('es-AR')}`,
    ``,
    `*${data.razonSocial || data.businessName}*`,
    data.businessCuit ? `CUIT: ${data.businessCuit}` : '',
    ``,
    `Cliente: ${data.customerName || 'Consumidor Final'}`,
    ``,
    ...data.items.map(i => `• ${i.product.name} x${i.quantity} → ${formatCurrency(i.price * i.quantity)}`),
    ``,
    `*TOTAL: ${formatCurrency(data.total)}*`,
    data.cae ? `CAE: ${data.cae}` : '',
    data.caeExpiry ? `Vto. CAE: ${data.caeExpiry}` : '',
  ].filter(Boolean).join('\n')

  const encoded = encodeURIComponent(lines)
  const base = 'https://wa.me/'
  return phone ? `${base}${phone.replace(/[^0-9]/g, '')}?text=${encoded}` : `${base}?text=${encoded}`
}

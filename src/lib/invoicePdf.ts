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

import {
  documentStyles, emitterBlock, printOnReadyScript, openPrintWindow,
  resolveAccent, type PrintMode,
} from '@/lib/documentLayout'

export interface InvoicePDFData {
  // Business
  businessName: string
  businessCuit?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  businessEmail?: string | null
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

  /** Mensaje configurable que se imprime al pie (Configuración → ticket). */
  receiptFooter?: string | null

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

export function generateInvoicePDF(data: InvoicePDFData, mode: PrintMode = 'color') {
  const letter = getInvoiceLetter(data.invoiceType)
  const color = resolveAccent(data.primaryColor || getInvoiceColor(data.invoiceType), mode)
  const isFacturaA = data.invoiceType === 'A'
  const fullNumber = `${pad(data.puntoVenta, 5)}-${pad(data.invoiceNumber, 8)}`

  const dateStr = data.date.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const discountAmount = data.subtotal * data.discount / 100
  const qrUrl = buildAfipQrUrlPdf(data)

  // Código AFIP del tipo de comprobante, para que la letra no quede ambigua.
  const cbteCode = ({ A: '01', B: '06', C: '11' } as Record<string, string>)[letter] || ''

  const itemsRows = data.items.map((item) => `
    <tr>
      <td class="desc">
        <span class="item-name">${item.product.name}</span>
        ${item.product.brand ? `<span class="item-brand">${item.product.brand}</span>` : ''}
      </td>
      <td class="num">${item.quantity}</td>
      <td class="num">${formatCurrency(item.price)}</td>
      <td class="num strong">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${letter} ${fullNumber}</title>
  <style>${documentStyles(color, mode)}</style>
</head>
<body>
  <div class="sheet">

    <div class="top">
${emitterBlock({
    businessName: data.businessName,
    businessCuit: data.businessCuit,
    businessAddress: data.businessAddress,
    businessPhone: data.businessPhone,
    businessEmail: data.businessEmail,
    razonSocial: data.razonSocial,
    domicilioComercial: data.domicilioComercial,
    ivaConditionLabel: getIvaLabel(data.ivaCondition),
    iibb: data.iibb,
    inicioActividades: data.inicioActividades,
    puntoVenta: data.puntoVenta,
    logoUrl: data.logoUrl,
  })}
      <div class="doc-block">
        <div class="letter-badge">
          <span class="letter">${letter}</span>
          ${cbteCode ? `<span class="code">COD. ${cbteCode}</span>` : ''}
        </div>
        <p class="doc-title">FACTURA ${letter}</p>
        <p class="doc-kind">Comprobante autorizado</p>
        <p class="doc-number">Nº ${fullNumber}</p>
        <p class="doc-meta">Fecha: <strong>${dateStr}</strong></p>
      </div>
    </div>

    <div class="customer">
      <p class="block-title">Datos del cliente</p>
      <p class="cname">${data.customerName || 'Consumidor Final'}</p>
      <div class="customer-grid">
        <p class="field"><span>${getDocLabel(data.customerDocTipo)}:</span> ${data.customerDocNro && data.customerDocNro !== '0' ? data.customerDocNro : '-'}</p>
        <p class="field"><span>Cond. IVA:</span> ${getIvaLabel(data.customerIvaCondition)}</p>
        ${data.customerAddress ? `<p class="field"><span>Domicilio:</span> ${data.customerAddress}</p>` : ''}
        <p class="field"><span>Forma de pago:</span> ${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}${data.installments && data.installments > 1 ? ` (${data.installments} cuotas)` : ''}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción / Producto</th>
          <th class="num">Cantidad</th>
          <th class="num">P. Unitario</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="row">
          <span class="label">Subtotal</span>
          <span class="pct"></span>
          <span class="val">${formatCurrency(data.subtotal)}</span>
        </div>
        ${data.discount > 0 ? `
        <div class="row">
          <span class="label">Descuento</span>
          <span class="pct">${data.discount}%</span>
          <span class="val">-${formatCurrency(discountAmount)}</span>
        </div>` : ''}
        ${data.surchargeAmount > 0 ? `
        <div class="row">
          <span class="label">Recargo</span>
          <span class="pct"></span>
          <span class="val">+${formatCurrency(data.surchargeAmount)}</span>
        </div>` : ''}
        ${isFacturaA ? `
        <div class="row">
          <span class="label">Neto gravado</span>
          <span class="pct"></span>
          <span class="val">${formatCurrency(data.netoGravado || 0)}</span>
        </div>
        <div class="row">
          <span class="label">IVA</span>
          <span class="pct">21%</span>
          <span class="val">${formatCurrency(data.ivaAmount || 0)}</span>
        </div>` : ''}
        <div class="row grand">
          <span class="label">Total</span>
          <span class="pct"></span>
          <span class="val">${formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>

    ${data.cae ? `
    <div class="callout">
      <div>
        <p class="callout-label">CAE (Código de Autorización Electrónico)</p>
        <p class="callout-value">${data.cae}</p>
        <p class="callout-label" style="margin-top:8px;">Fecha Vto. CAE</p>
        <p class="callout-sub">${data.caeExpiry || '-'}</p>
      </div>
      ${qrUrl ? `<div style="text-align:center;">
        <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}" alt="QR AFIP" />
        <p style="font-size:9px;color:#9ca3af;margin-top:3px;">Comprobante válido</p>
      </div>` : ''}
    </div>` : ''}

    <div class="spacer"></div>

    <div class="footer">
      ${data.receiptFooter ? `<p class="message">${data.receiptFooter}</p>` : ''}
      <p>Ante cualquier consulta sobre este comprobante, comuníquese con nosotros${data.businessPhone ? ` al ${data.businessPhone}` : ''}.</p>
      <p class="legal">Comprobante electrónico emitido según RG AFIP ${isFacturaA ? '4291' : '4004'}</p>
    </div>

  </div>
${printOnReadyScript}
</body>
</html>`

  return html
}

/** Abre la factura en ventana nueva para imprimir o guardar como PDF. */
export function openInvoicePDF(data: InvoicePDFData, mode: PrintMode = 'color') {
  openPrintWindow(generateInvoicePDF(data, mode))
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

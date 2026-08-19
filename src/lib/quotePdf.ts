/**
 * Generador de presupuestos en A4.
 *
 * Comparte el layout con la factura (ver documentLayout.ts), pero no es un
 * comprobante fiscal: sin letra A/B/C, sin CAE y sin QR de AFIP. En su lugar
 * lleva la fecha de validez y la leyenda que lo aclara.
 */

import { formatCurrency } from '@/lib/utils'
import {
  documentStyles, emitterBlock, printOnReadyScript, openPrintWindow,
} from '@/lib/documentLayout'

export interface QuoteItemData {
  description: string
  brand?: string | null
  quantity: number
  price: number
}

export interface QuotePDFData {
  // Emisor
  businessName: string
  businessCuit?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  razonSocial?: string | null
  domicilioComercial?: string | null
  ivaConditionLabel?: string

  // Documento
  quoteNumber: number
  date: Date
  validUntil?: Date | null
  notes?: string | null

  // Cliente
  customerName: string
  customerPhone?: string | null
  customerAddress?: string | null

  // Ítems
  items: QuoteItemData[]
  subtotal: number
  discount: number
  total: number

  // Branding
  logoUrl?: string | null
  primaryColor?: string
}

const DEFAULT_COLOR = '#7c3aed'

function pad(n: number, len: number) {
  return String(n).padStart(len, '0')
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Cantidad sin decimales de relleno: 2 en vez de 2,000 pero 1,5 se mantiene. */
function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace('.', ',')
}

export function generateQuotePDF(data: QuotePDFData): string {
  const color = data.primaryColor || DEFAULT_COLOR
  const number = pad(data.quoteNumber, 8)
  const discountAmount = data.subtotal * data.discount / 100

  const itemsRows = data.items.map((item) => `
    <tr>
      <td class="desc">
        <span class="item-name">${item.description}</span>
        ${item.brand ? `<span class="item-brand">${item.brand}</span>` : ''}
      </td>
      <td class="num">${formatQty(item.quantity)}</td>
      <td class="num">${formatCurrency(item.price)}</td>
      <td class="num strong">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Presupuesto ${number}</title>
  <style>${documentStyles(color)}</style>
</head>
<body>
  <div class="sheet">

    <div class="top">
${emitterBlock({
    businessName: data.businessName,
    businessCuit: data.businessCuit,
    businessAddress: data.businessAddress,
    businessPhone: data.businessPhone,
    razonSocial: data.razonSocial,
    domicilioComercial: data.domicilioComercial,
    ivaConditionLabel: data.ivaConditionLabel,
    logoUrl: data.logoUrl,
  })}
      <div class="doc-block">
        <p class="doc-title">PRESUPUESTO <span>Nº: ${number}</span></p>
        <p class="doc-meta">Fecha: ${formatDate(data.date)}</p>
        ${data.validUntil ? `<p class="doc-meta">Válido hasta: ${formatDate(data.validUntil)}</p>` : ''}
      </div>
    </div>

    <div class="customer">
      <p class="block-title">Datos cliente</p>
      <p>${data.customerName || 'Consumidor Final'}</p>
      ${data.customerAddress ? `<p>${data.customerAddress}</p>` : ''}
      ${data.customerPhone ? `<p>${data.customerPhone}</p>` : ''}
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
        <div class="row grand">
          <span class="label">Total</span>
          <span class="pct"></span>
          <span class="val">${formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>

    ${data.validUntil ? `
    <div class="callout">
      <div>
        <p class="callout-label">Validez de la oferta</p>
        <p class="callout-value">Hasta el ${data.validUntil.toLocaleDateString('es-AR')}</p>
      </div>
      <div style="text-align:right;">
        <p class="callout-label">Total presupuestado</p>
        <p class="callout-value" style="color:${color};">${formatCurrency(data.total)}</p>
      </div>
    </div>` : ''}

    ${data.notes ? `
    <div class="notes">
      <p class="block-title">Observaciones</p>
      <p class="body">${data.notes}</p>
    </div>` : ''}

    <div class="spacer"></div>

    <div class="footer">
      <p>Ante cualquier consulta sobre este presupuesto, comuníquese con nosotros${data.businessPhone ? ` al ${data.businessPhone}` : ''}.</p>
      <p class="legal">Este presupuesto no constituye comprobante fiscal. Los precios pueden estar sujetos a modificación una vez vencida la fecha de validez y están sujetos a disponibilidad de stock.</p>
    </div>

  </div>
${printOnReadyScript}
</body>
</html>`

  return html
}

/** Abre el presupuesto en ventana nueva para imprimir o guardar como PDF. */
export function openQuotePDF(data: QuotePDFData) {
  openPrintWindow(generateQuotePDF(data))
}

/** Link de WhatsApp con el resumen del presupuesto. */
export function getQuoteWhatsAppLink(data: QuotePDFData, phone?: string | null): string {
  const lines = [
    `📋 *Presupuesto Nº ${pad(data.quoteNumber, 8)}*`,
    `Fecha: ${data.date.toLocaleDateString('es-AR')}`,
    data.validUntil ? `Válido hasta: ${data.validUntil.toLocaleDateString('es-AR')}` : '',
    ``,
    `*${data.razonSocial || data.businessName}*`,
    ``,
    `Cliente: ${data.customerName || '-'}`,
    ``,
    ...data.items.map(i => `• ${i.description} x${formatQty(i.quantity)} → ${formatCurrency(i.price * i.quantity)}`),
    ``,
    data.discount > 0 ? `Descuento: ${data.discount}%` : '',
    `*TOTAL: ${formatCurrency(data.total)}*`,
    data.notes ? `\n${data.notes}` : '',
  ].filter(Boolean).join('\n')

  const encoded = encodeURIComponent(lines)
  const clean = phone?.replace(/[^0-9]/g, '') || ''
  return `https://wa.me/${clean}?text=${encoded}`
}

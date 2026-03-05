/**
 * Template engine with {{variable}} interpolation.
 *
 * Variables are grouped for UI chip rendering.
 * Missing variables are collected for validation feedback.
 */

import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

// ── Variable Groups (for chip UI) ──────────────────────────
export interface VarGroup {
  label: string
  vars: { key: string; label: string; example: string }[]
}

export const VARIABLE_GROUPS: VarGroup[] = [
  {
    label: 'Cliente',
    vars: [
      { key: 'customer.name', label: 'Nombre', example: 'Juan Pérez' },
      { key: 'customer.phone', label: 'Teléfono', example: '11 2345-6789' },
      { key: 'customer.balance', label: 'Saldo', example: '$5.000,00' },
    ],
  },
  {
    label: 'Venta',
    vars: [
      { key: 'sale.total', label: 'Total', example: '$12.500,00' },
      { key: 'sale.date', label: 'Fecha', example: '03/03/2026' },
      { key: 'sale.items_count', label: 'Cant. items', example: '5' },
    ],
  },
  {
    label: 'Factura',
    vars: [
      { key: 'invoice.number', label: 'Número', example: '0001-00000123' },
      { key: 'invoice.cae', label: 'CAE', example: '74512345678901' },
      { key: 'invoice.pdf_url', label: 'Link PDF', example: 'https://...' },
    ],
  },
  {
    label: 'Cuenta',
    vars: [
      { key: 'statement.url', label: 'Link estado', example: 'https://...' },
    ],
  },
  {
    label: 'Links',
    vars: [
      { key: 'ticket.url', label: 'Link ticket', example: 'https://...' },
      { key: 'catalog.url', label: 'Link catálogo', example: 'https://...' },
    ],
  },
  {
    label: 'Negocio',
    vars: [
      { key: 'business.name', label: 'Nombre', example: 'Mi Tienda' },
    ],
  },
  {
    label: 'Fecha',
    vars: [
      { key: 'today', label: 'Hoy', example: '03/03/2026' },
      { key: 'time', label: 'Hora', example: '14:30' },
    ],
  },
]

// ── Context type ────────────────────────────────────────────
export interface TemplateContext {
  customer?: {
    name?: string
    phone?: string
    balance?: number
  }
  sale?: {
    total?: number
    date?: string | Date
    items_count?: number
  }
  invoice?: {
    number?: string
    cae?: string
    pdf_url?: string
  }
  statement?: { url?: string }
  ticket?: { url?: string }
  catalog?: { url?: string }
  business?: { name?: string }
  [key: string]: unknown
}

// ── Engine ──────────────────────────────────────────────────
export interface RenderResult {
  result: string
  missingVars: string[]
}

export function renderTemplate(template: string, ctx: TemplateContext): RenderResult {
  const missingVars: string[] = []
  const now = new Date()

  // Build flat lookup map
  const lookup: Record<string, string> = {
    'today': formatDate(now),
    'time': now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  }

  // Flatten context
  if (ctx.customer) {
    if (ctx.customer.name) lookup['customer.name'] = ctx.customer.name
    if (ctx.customer.phone) lookup['customer.phone'] = ctx.customer.phone
    if (ctx.customer.balance !== undefined)
      lookup['customer.balance'] = formatCurrency(Math.abs(ctx.customer.balance))
  }
  if (ctx.sale) {
    if (ctx.sale.total !== undefined) lookup['sale.total'] = formatCurrency(ctx.sale.total)
    if (ctx.sale.date) lookup['sale.date'] = formatDate(ctx.sale.date)
    if (ctx.sale.items_count !== undefined) lookup['sale.items_count'] = String(ctx.sale.items_count)
  }
  if (ctx.invoice) {
    if (ctx.invoice.number) lookup['invoice.number'] = ctx.invoice.number
    if (ctx.invoice.cae) lookup['invoice.cae'] = ctx.invoice.cae
    if (ctx.invoice.pdf_url) lookup['invoice.pdf_url'] = ctx.invoice.pdf_url
  }
  if (ctx.statement?.url) lookup['statement.url'] = ctx.statement.url
  if (ctx.ticket?.url) lookup['ticket.url'] = ctx.ticket.url
  if (ctx.catalog?.url) lookup['catalog.url'] = ctx.catalog.url
  if (ctx.business?.name) lookup['business.name'] = ctx.business.name

  // Replace {{var}} patterns
  const result = template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    if (key in lookup) return lookup[key]
    missingVars.push(key)
    return `{{${key}}}`
  })

  return { result, missingVars }
}

/** Extract all variable keys from a template string */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)
  return [...new Set([...matches].map((m) => m[1]))]
}

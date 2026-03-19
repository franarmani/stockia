/**
 * exportWriter.ts
 * Generates .xlsx and .csv from products data.
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { generateTemplate } from './excelParser'
import type { Product } from '@/types/database'

export interface ExportColumn {
  field: keyof Product | 'category_name'
  label: string
  enabled: boolean
}

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'name',           label: 'Nombre',          enabled: true  },
  { field: 'sale_price',     label: 'Precio venta',    enabled: true  },
  { field: 'purchase_price', label: 'Precio compra',   enabled: true  },
  { field: 'stock',          label: 'Stock',            enabled: true  },
  { field: 'stock_min',      label: 'Stock mínimo',    enabled: true  },
  { field: 'barcode',        label: 'Código de barras', enabled: true  },
  { field: 'category_name',  label: 'Categoría',        enabled: true  },
  { field: 'unit',           label: 'Unidad',           enabled: true  },
  { field: 'brand',          label: 'Marca',            enabled: false },
  { field: 'description',    label: 'Descripción',      enabled: false },
  { field: 'active',         label: 'Activo',           enabled: false },
]

export interface ExportOptions {
  columns: ExportColumn[]
  format: 'xlsx' | 'csv'
  filename?: string
}

type ProductWithCategory = Product & { category_name?: string }

function buildRows(products: ProductWithCategory[], columns: ExportColumn[]): Record<string, unknown>[] {
  const activeCols = columns.filter((c) => c.enabled)
  return products.map((p) => {
    const row: Record<string, unknown> = {}
    for (const col of activeCols) {
      if (col.field === 'category_name') {
        row[col.label] = p.category_name || ''
      } else if (col.field === 'active') {
        row[col.label] = p.active ? 'Sí' : 'No'
      } else {
        row[col.label] = p[col.field as keyof Product] ?? ''
      }
    }
    return row
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportProducts(products: ProductWithCategory[], options: ExportOptions) {
  const rows = buildRows(products, options.columns)
  const baseName = options.filename || `productos_${new Date().toISOString().slice(0, 10)}`

  if (options.format === 'csv') {
    const csv = Papa.unparse(rows, { quotes: true, delimiter: ',' })
    triggerDownload(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${baseName}.csv`)
  } else {
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto column widths
    const maxLen = (s: string) => Math.min(Math.max(String(s).length, 10), 40)
    ws['!cols'] = options.columns.filter((c) => c.enabled).map((c) => ({ wch: maxLen(c.label) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
    triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${baseName}.xlsx`)
  }
}

export function downloadTemplate() {
  const buf = generateTemplate()
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'plantilla_productos.xlsx'
  )
}

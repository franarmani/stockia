// Detección de columnas de una planilla de productos con IA (sin APIs de Deno, se prueba con vitest).

export const PRODUCT_FIELDS = {
  name: 'nombre o descripción del producto',
  sale_price: 'precio de venta al público',
  purchase_price: 'precio de costo o de compra',
  stock: 'cantidad en stock / existencia',
  stock_min: 'stock mínimo',
  barcode: 'código de barras (EAN, UPC) de 8 a 14 dígitos',
  code: 'código interno o propio del comercio, SKU, número o referencia corta del artículo',
  category: 'categoría, rubro o familia',
  unit: 'unidad de medida (u, kg, mts, lts)',
  description: 'detalle u observaciones adicionales',
  brand: 'marca o fabricante',
  active: 'si está activo o habilitado',
} as const

export type AiField = keyof typeof PRODUCT_FIELDS

export function buildColumnsPrompt(preview: string[][]): string {
  const table = preview.map((row, i) => `Fila ${i}: ${row.map((cell, j) => `[${j}] ${cell || '—'}`).join(' | ')}`).join('\n')
  const fields = Object.entries(PRODUCT_FIELDS).map(([key, label]) => `- ${key}: ${label}`).join('\n')
  return `Estas son las primeras filas de una planilla de productos de un comercio argentino.
Puede tener títulos, logos o filas vacías antes de los encabezados, o no tener encabezados.

${table}

Campos posibles:
${fields}

Respondé SOLO un JSON con esta forma:
{"header_row": <número de la fila con los encabezados, o -1 si no hay encabezados>, "columns": {"<índice de columna>": "<campo>"}}
Reglas: cada campo se usa una sola vez; incluí solo columnas que estés seguro; si hay dos precios, el mayor suele ser el de venta y el menor el de costo; no inventes campos.`
}

/** Valida y limpia lo que devolvió la IA: índices dentro de la planilla, campos conocidos y sin repetir. */
export function parseColumnsAnswer(answer: unknown, width: number, rows: number): { header_row: number; columns: Record<number, AiField> } | null {
  let data: any = answer
  if (typeof answer === 'string') {
    try { data = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)) } catch { return null }
  }
  if (!data || typeof data !== 'object') return null
  const headerRow = Number(data.header_row)
  const columns: Record<number, AiField> = {}
  const used = new Set<string>()
  for (const [key, value] of Object.entries(data.columns ?? {})) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= width) continue
    if (typeof value !== 'string' || !(value in PRODUCT_FIELDS) || used.has(value)) continue
    used.add(value)
    columns[index] = value as AiField
  }
  if (!used.has('name')) return null
  return { header_row: Number.isInteger(headerRow) && headerRow >= -1 && headerRow < rows ? headerRow : 0, columns }
}

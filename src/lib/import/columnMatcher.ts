/**
 * columnMatcher.ts
 * Auto-detects CSV/Excel column headers and maps them to product fields.
 * Uses synonym tables + fuzzy contains matching.
 */

export type ProductField =
  | 'name'
  | 'sale_price'
  | 'purchase_price'
  | 'stock'
  | 'stock_min'
  | 'barcode'
  | 'category'
  | 'unit'
  | 'description'
  | 'brand'
  | 'active'

export const FIELD_LABELS: Record<ProductField, string> = {
  name: 'Nombre',
  sale_price: 'Precio venta',
  purchase_price: 'Precio compra',
  stock: 'Stock',
  stock_min: 'Stock mínimo',
  barcode: 'Código de barras',
  category: 'Categoría',
  unit: 'Unidad',
  description: 'Descripción',
  brand: 'Marca',
  active: 'Activo',
}

export const REQUIRED_FIELDS: ProductField[] = ['name', 'sale_price']

const SYNONYMS: Record<ProductField, string[]> = {
  name: ['nombre', 'producto', 'item', 'articulo', 'articulos', 'descripcion', 'title', 'name', 'denominacion'],
  sale_price: ['precio', 'precio_venta', 'p_venta', 'venta', 'price', 'importe', 'precio_final', 'pvp', 'valor', 'p_vta'],
  purchase_price: ['costo', 'precio_compra', 'p_compra', 'compra', 'cost', 'precio_costo', 'p_costo'],
  stock: ['stock', 'cantidad', 'existencia', 'existencias', 'qty', 'cant', 'inventario', 'disponible'],
  stock_min: ['stock_min', 'minimo', 'stock_minimo', 'reorder', 'reponer', 'minstock', 'min', 'alerta_stock'],
  barcode: ['codigo', 'codigo_barras', 'barcode', 'ean', 'upc', 'cod_barra', 'sku', 'referencia', 'ref'],
  category: ['categoria', 'rubro', 'tipo', 'category', 'subfamilia', 'familia', 'grupo'],
  unit: ['unidad', 'unit', 'uom', 'medida', 'u_medida'],
  description: ['detalle', 'obs', 'observacion', 'notas', 'nota', 'info', 'informacion', 'description'],
  brand: ['marca', 'brand', 'fabricante', 'laboratorio'],
  active: ['activo', 'habilitado', 'enabled', 'status', 'estado', 'vigente'],
}

/** Normalize a header string: lowercase, remove accents, replace spaces/special chars with _ */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

/** Try to match a normalized header to a ProductField */
function matchField(normalized: string): ProductField | null {
  // Exact match first
  for (const [field, synonyms] of Object.entries(SYNONYMS) as [ProductField, string[]][]) {
    if (synonyms.includes(normalized)) return field
  }
  // Contains match
  for (const [field, synonyms] of Object.entries(SYNONYMS) as [ProductField, string[]][]) {
    for (const syn of synonyms) {
      if (normalized.includes(syn) || syn.includes(normalized)) return field
    }
  }
  return null
}

export interface ColumnMapping {
  /** Original header as it appears in the file */
  original: string
  /** Normalized version */
  normalized: string
  /** Detected field (null = not detected) */
  field: ProductField | null
}

/** Given raw headers from Excel/CSV, return auto-detected column mappings */
export function detectColumns(headers: string[]): ColumnMapping[] {
  const assigned = new Set<ProductField>()
  return headers.map((h) => {
    const normalized = normalizeHeader(h)
    let field = matchField(normalized)
    // Avoid assigning same field twice — second occurrence stays null
    if (field && assigned.has(field)) field = null
    if (field) assigned.add(field)
    return { original: h, normalized, field }
  })
}

/** Returns which required fields are missing from a mapping array */
export function getMissingRequired(mappings: ColumnMapping[]): ProductField[] {
  const mapped = new Set(mappings.map((m) => m.field).filter(Boolean))
  return REQUIRED_FIELDS.filter((f) => !mapped.has(f))
}

/**
 * importApi.ts
 * Validates parsed rows using Zod, then sends batches to Supabase.
 * Falls back to direct upsert if Edge Function is unavailable.
 */

import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ColumnMapping, ProductField } from './columnMatcher'
import { parseNumberAR, parseBooleanAR, parseBarcode } from './priceParserAR'

export interface MappedRow {
  rowIndex: number   // 1-based (skipping header)
  raw: Record<string, unknown>
  mapped: Partial<ProductRowInput>
  errors: RowError[]
}

export interface RowError {
  rowIndex: number
  field: string
  message: string
  value: unknown
}

export interface ProductRowInput {
  name: string
  sale_price: number
  purchase_price: number
  stock: number
  stock_min: number
  barcode: string | null
  category: string | null
  unit: string
  description: string | null
  brand: string | null
  active: boolean
}

export type ImportMode = 'create' | 'update' | 'upsert'
export type MatchBy = 'barcode' | 'name'

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: RowError[]
}

/** Map raw Excel rows using a column mapping array → validated MappedRow[] */
export function mapAndValidateRows(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[],
): MappedRow[] {
  const fieldToHeader: Partial<Record<ProductField, string>> = {}
  for (const m of mappings) {
    if (m.field) fieldToHeader[m.field] = m.original
  }

  function getRaw(row: Record<string, unknown>, field: ProductField): unknown {
    const header = fieldToHeader[field]
    return header !== undefined ? row[header] : undefined
  }

  return rows.map((raw, idx) => {
    const rowIndex = idx + 2  // 1-based + header row
    const errors: RowError[] = []
    const mapped: Partial<ProductRowInput> = {}

    // name
    const nameRaw = getRaw(raw, 'name')
    const name = nameRaw !== undefined ? String(nameRaw).trim() : ''
    if (!name) {
      errors.push({ rowIndex, field: 'name', message: 'Nombre requerido', value: nameRaw })
    } else {
      mapped.name = name
    }

    // sale_price
    const spRaw = getRaw(raw, 'sale_price')
    if (spRaw !== undefined) {
      const sp = parseNumberAR(spRaw)
      if (sp === null || sp < 0) {
        errors.push({ rowIndex, field: 'sale_price', message: `Precio inválido (valor: "${spRaw}")`, value: spRaw })
      } else {
        mapped.sale_price = sp
      }
    } else {
      errors.push({ rowIndex, field: 'sale_price', message: 'Precio de venta requerido', value: undefined })
    }

    // purchase_price
    const ppRaw = getRaw(raw, 'purchase_price')
    if (ppRaw !== undefined && ppRaw !== '') {
      const pp = parseNumberAR(ppRaw)
      if (pp !== null && pp >= 0) mapped.purchase_price = pp
      else errors.push({ rowIndex, field: 'purchase_price', message: `Precio compra inválido (valor: "${ppRaw}")`, value: ppRaw })
    } else {
      mapped.purchase_price = 0
    }

    // stock
    const stRaw = getRaw(raw, 'stock')
    if (stRaw !== undefined && stRaw !== '') {
      const st = parseNumberAR(stRaw)
      if (st !== null && st >= 0) mapped.stock = st
      else errors.push({ rowIndex, field: 'stock', message: `Stock inválido (valor: "${stRaw}")`, value: stRaw })
    } else {
      mapped.stock = 0
    }

    // stock_min
    const smRaw = getRaw(raw, 'stock_min')
    if (smRaw !== undefined && smRaw !== '') {
      const sm = parseNumberAR(smRaw)
      if (sm !== null && sm >= 0) mapped.stock_min = sm
      else errors.push({ rowIndex, field: 'stock_min', message: `Stock mínimo inválido`, value: smRaw })
    } else {
      mapped.stock_min = 3
    }

    // barcode
    const bcRaw = getRaw(raw, 'barcode')
    mapped.barcode = bcRaw !== undefined ? parseBarcode(bcRaw) : null

    // category
    const catRaw = getRaw(raw, 'category')
    mapped.category = catRaw !== undefined && String(catRaw).trim() ? String(catRaw).trim() : null

    // unit
    const unitRaw = getRaw(raw, 'unit')
    const validUnits = ['u', 'kg', 'mts', 'lts']
    if (unitRaw !== undefined && String(unitRaw).trim()) {
      const u = String(unitRaw).trim().toLowerCase()
      mapped.unit = validUnits.includes(u) ? u : 'u'
    } else {
      mapped.unit = 'u'
    }

    // description
    const descRaw = getRaw(raw, 'description')
    mapped.description = descRaw !== undefined && String(descRaw).trim() ? String(descRaw).trim() : null

    // brand
    const brandRaw = getRaw(raw, 'brand')
    mapped.brand = brandRaw !== undefined && String(brandRaw).trim() ? String(brandRaw).trim() : null

    // active
    const activeRaw = getRaw(raw, 'active')
    mapped.active = activeRaw !== undefined ? (parseBooleanAR(activeRaw) ?? true) : true

    return { rowIndex, raw, mapped, errors }
  })
}

/** Run the actual import in batches of 200, calling Edge Function */
export async function runImport(
  businessId: string,
  mappedRows: MappedRow[],
  mode: ImportMode,
  matchBy: MatchBy,
  onProgress: (pct: number, processed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  const validRows = mappedRows.filter((r) => r.errors.length === 0)
  const allErrors: RowError[] = mappedRows.flatMap((r) => r.errors)
  let created = 0, updated = 0, skipped = 0

  const BATCH = 200
  const total = validRows.length

  for (let i = 0; i < total; i += BATCH) {
    if (signal?.aborted) break
    const batch = validRows.slice(i, i + BATCH)
    const rows = batch.map((r) => r.mapped)

    const { data, error } = await supabase.functions.invoke('products-import', {
      body: { business_id: businessId, mode, match_by: matchBy, rows },
    })

    if (error) {
      // Edge Function unavailable — fallback to direct upsert
      const fallbackResult = await fallbackBatchUpsert(businessId, batch, mode, matchBy)
      created += fallbackResult.created
      updated += fallbackResult.updated
      skipped += fallbackResult.skipped
      allErrors.push(...fallbackResult.errors)
    } else {
      created += data.created || 0
      updated += data.updated || 0
      skipped += data.skipped || 0
      if (data.errors?.length) allErrors.push(...data.errors)
    }

    onProgress(Math.min(100, Math.round(((i + batch.length) / total) * 100)), i + batch.length, total)
  }

  // Log the import
  try {
    await supabase.from('import_logs').insert({
      business_id: businessId,
      mode,
      total_rows: total,
      created,
      updated,
      skipped,
      errors_json: allErrors.slice(0, 100), // cap stored errors
    })
  } catch {}

  return { created, updated, skipped, errors: allErrors }
}

/** Fallback: direct Supabase upsert (when Edge Function is not available) */
async function fallbackBatchUpsert(
  businessId: string,
  batch: MappedRow[],
  mode: ImportMode,
  matchBy: MatchBy,
): Promise<ImportResult> {
  let created = 0, updated = 0, skipped = 0
  const errors: RowError[] = []

  // Resolve category names → IDs
  const categoryNames = [...new Set(batch.map((r) => r.mapped.category).filter(Boolean))] as string[]
  const categoryMap: Record<string, string> = {}
  if (categoryNames.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('business_id', businessId)
      .in('name', categoryNames)
    for (const c of cats || []) categoryMap[c.name.toLowerCase()] = c.id
    // Create missing categories
    for (const name of categoryNames) {
      if (!categoryMap[name.toLowerCase()]) {
        const { data: newCat } = await supabase.from('categories').insert({ business_id: businessId, name }).select().single()
        if (newCat) categoryMap[name.toLowerCase()] = newCat.id
      }
    }
  }

  for (const row of batch) {
    const m = row.mapped as ProductRowInput
    const categoryId = m.category ? (categoryMap[m.category.toLowerCase()] || null) : null
    const payload = {
      business_id: businessId,
      name: m.name,
      sale_price: m.sale_price,
      purchase_price: m.purchase_price || 0,
      avg_cost: m.purchase_price || 0,
      stock: m.stock ?? 0,
      stock_min: m.stock_min ?? 3,
      barcode: m.barcode || null,
      category_id: categoryId,
      unit: m.unit || 'u',
      description: m.description || null,
      brand: m.brand || null,
      active: m.active ?? true,
    }

    if (mode === 'create') {
      const { error } = await supabase.from('products').insert(payload)
      if (error) {
        if (error.code === '23505') skipped++
        else errors.push({ rowIndex: row.rowIndex, field: 'general', message: error.message, value: null })
      } else {
        created++
      }
    } else {
      // Upsert / update
      let existing: { id: string } | null = null
      if (matchBy === 'barcode' && m.barcode) {
        const { data } = await supabase.from('products').select('id').eq('business_id', businessId).eq('barcode', m.barcode).maybeSingle()
        existing = data
      }
      if (!existing) {
        const { data } = await supabase.from('products').select('id').eq('business_id', businessId).ilike('name', m.name).maybeSingle()
        existing = data
      }

      if (existing) {
        if (mode === 'update' || mode === 'upsert') {
          const { error } = await supabase.from('products').update(payload).eq('id', existing.id)
          if (error) errors.push({ rowIndex: row.rowIndex, field: 'general', message: error.message, value: null })
          else updated++
        } else {
          skipped++
        }
      } else {
        if (mode === 'upsert' || mode === 'create') {
          const { error } = await supabase.from('products').insert(payload)
          if (error) errors.push({ rowIndex: row.rowIndex, field: 'general', message: error.message, value: null })
          else created++
        } else {
          skipped++
        }
      }
    }
  }

  return { created, updated, skipped, errors }
}

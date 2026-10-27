import { describe, expect, it } from 'vitest'
import { detectColumns } from '../columnMatcher'

describe('detección de columnas', () => {
  it('separa el código propio del código de barras', () => {
    const fields = detectColumns(['Código interno', 'EAN', 'Nombre', 'Precio']).map((c) => c.field)
    expect(fields).toEqual(['code', 'barcode', 'name', 'sale_price'])
  })
  it('SKU y referencia son código propio', () => {
    expect(detectColumns(['SKU']).map((c) => c.field)).toEqual(['code'])
  })
})

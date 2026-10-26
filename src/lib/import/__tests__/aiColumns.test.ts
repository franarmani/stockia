import { describe, expect, it } from 'vitest'
import { buildColumnsPrompt, parseColumnsAnswer } from '../../../../supabase/functions/_shared/aiColumns'

describe('detección de columnas con IA', () => {
  it('acepta columnas válidas y descarta índices, campos inventados y repetidos', () => {
    const answer = JSON.stringify({ header_row: 2, columns: { 0: 'barcode', 1: 'name', 3: 'sale_price', 4: 'sale_price', 9: 'stock', 2: 'color' } })
    expect(parseColumnsAnswer(answer, 5, 20)).toEqual({ header_row: 2, columns: { 0: 'barcode', 1: 'name', 3: 'sale_price' } })
  })

  it('rechaza respuestas sin columna de nombre o que no son JSON', () => {
    expect(parseColumnsAnswer('{"header_row":0,"columns":{"0":"sale_price"}}', 3, 5)).toBeNull()
    expect(parseColumnsAnswer('no sé', 3, 5)).toBeNull()
  })

  it('tolera texto alrededor del JSON y fila de encabezados fuera de rango', () => {
    expect(parseColumnsAnswer('Acá va: {"header_row": 99, "columns": {"1": "name"}} listo', 3, 5)).toEqual({ header_row: 0, columns: { 1: 'name' } })
  })

  it('arma el pedido con las filas y los índices de columna', () => {
    const prompt = buildColumnsPrompt([['LISTA DE PRECIOS'], ['Código', 'Artículo', 'Precio']])
    expect(prompt).toContain('Fila 1: [0] Código | [1] Artículo | [2] Precio')
  })
})

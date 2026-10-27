import { describe, expect, it } from 'vitest'
import { GUIDES, searchGuides } from '../guides'

describe('ayuda', () => {
  it('busca sin tildes ni mayúsculas', () => {
    expect(searchGuides('DEPOSITO').map(g => g.id)).toContain('depositos')
    expect(searchGuides('codigo encargado').map(g => g.id)).toEqual(expect.arrayContaining(['anular-venta', 'usuarios']))
  })
  it('sin búsqueda muestra todas', () => {
    expect(searchGuides('  ')).toHaveLength(GUIDES.length)
  })
  it('los ids no se repiten', () => {
    expect(new Set(GUIDES.map(g => g.id)).size).toBe(GUIDES.length)
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sync/syncEngine', () => ({ syncEngine: {} }))
vi.mock('@/sync/storage', () => ({ getLocalRows: vi.fn() }))

import { autoCloseDue, expectedCash } from '../autoClose'

const at = (s: string) => new Date(s)

describe('cierre automático de caja', () => {
  it('no cierra antes de la hora', () => {
    expect(autoCloseDue(at('2026-10-27T09:00:00'), '22:00', at('2026-10-27T21:59:00'))).toBeNull()
  })
  it('cierra a la hora programada del mismo día', () => {
    expect(autoCloseDue(at('2026-10-27T09:00:00'), '22:00', at('2026-10-27T22:00:30'))).toEqual(at('2026-10-27T22:00:00'))
  })
  it('si se abrió después de la hora, cierra al día siguiente', () => {
    expect(autoCloseDue(at('2026-10-27T23:00:00'), '22:00', at('2026-10-28T08:00:00'))).toBeNull()
    expect(autoCloseDue(at('2026-10-27T23:00:00'), '22:00', at('2026-10-28T22:05:00'))).toEqual(at('2026-10-28T22:00:00'))
  })
  it('con el equipo apagado, al abrir cierra con la hora programada', () => {
    expect(autoCloseDue(at('2026-10-27T09:00:00'), '22:00', at('2026-10-29T10:00:00'))).toEqual(at('2026-10-27T22:00:00'))
  })
  it('calcula el efectivo esperado', () => {
    expect(expectedCash({ opening_amount: 1000 }, [
      { type: 'sale', amount: 500 }, { type: 'income', amount: 200 }, { type: 'withdrawal', amount: 300 },
    ])).toBe(1400)
  })
})

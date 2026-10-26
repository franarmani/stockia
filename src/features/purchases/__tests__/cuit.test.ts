import { describe, expect, it } from 'vitest'
import { formatCuit, isValidCuit, normalizeCuit } from '../cuit'
import { fromCents, multiplyMoney, toCents } from '../money'

describe('CUIT', () => {
  it('normaliza y formatea', () => {
    expect(normalizeCuit('20-12345678-6')).toBe('20123456786')
    expect(formatCuit('20123456786')).toBe('20-12345678-6')
  })

  it('valida el digito verificador', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true)
    expect(isValidCuit('20-12345678-9')).toBe(false)
  })
})

describe('dinero', () => {
  it('calcula en centavos sin floats monetarios acumulados', () => {
    expect(toCents('10,50')).toBe(1050)
    expect(multiplyMoney('10.50', '3')).toBe(3150)
    expect(fromCents(3150)).toBe('31.50')
  })
})

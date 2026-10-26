import { describe, expect, it } from 'vitest'
import { businessRecord, emptyRegistration, validateRegistration, validateRegistrationStep, type RegistrationData } from '../registration'

const complete: RegistrationData = {
  ...emptyRegistration,
  businessName: 'Corralón El Puente',
  businessType: 'corralon',
  phone: '+54 9 291 555-1234',
  address: 'Av. Alem 1234',
  city: 'Bahía Blanca',
  province: 'Buenos Aires',
  cuit: '20-12345678-6',
  razonSocial: 'Juan Pérez',
  ivaCondition: 'monotributo',
  fullName: 'Juan Pérez',
  email: 'Juan@Ejemplo.com ',
  password: 'segura123',
}

describe('account registration', () => {
  it('accepts a complete registration', () => {
    expect(validateRegistration(complete)).toBeNull()
  })

  it('requires the business type, and a description when it is "otro"', () => {
    expect(validateRegistrationStep(0, { ...complete, businessType: '' })).toBe('Elegí el rubro de tu negocio')
    expect(validateRegistrationStep(0, { ...complete, businessType: 'inventado' })).toBe('Elegí el rubro de tu negocio')
    expect(validateRegistrationStep(0, { ...complete, businessType: 'otro', businessTypeOther: '' })).toBe('Contanos cuál es tu rubro')
    expect(validateRegistrationStep(0, { ...complete, businessType: 'otro', businessTypeOther: 'Vivero' })).toBeNull()
  })

  it('validates contact, location and fiscal data', () => {
    expect(validateRegistrationStep(0, { ...complete, phone: '123' })).toMatch(/teléfono/)
    expect(validateRegistrationStep(1, { ...complete, address: '' })).toMatch(/dirección/)
    expect(validateRegistrationStep(1, { ...complete, province: 'Narnia' })).toMatch(/provincia/)
    expect(validateRegistrationStep(1, { ...complete, cuit: '20-12345678-0' })).toMatch(/CUIT/)
    expect(validateRegistrationStep(1, { ...complete, ivaCondition: 'consumidor_final' })).toMatch(/IVA/)
    expect(validateRegistrationStep(2, { ...complete, password: '1234567' })).toMatch(/8 caracteres/)
    expect(validateRegistrationStep(2, { ...complete, email: 'no-es-email' })).toMatch(/email/)
  })

  it('reports the first incomplete step', () => {
    expect(validateRegistration({ ...complete, cuit: '' })).toMatchObject({ step: 1 })
  })

  it('stores the business ready for invoices and the store', () => {
    const record = businessRecord({ ...complete, businessType: 'otro', businessTypeOther: 'Vivero' }, new Date('2026-11-01T00:00:00Z'))
    expect(record).toMatchObject({
      name: 'Corralón El Puente',
      business_type: 'otro: Vivero',
      cuit: '20123456786',
      iva_condition: 'monotributo',
      domicilio_comercial: 'Av. Alem 1234, Bahía Blanca, Buenos Aires',
      email: 'juan@ejemplo.com',
      subscription_status: 'trial',
      trial_ends_at: '2026-11-01T00:00:00.000Z',
    })
  })
})

import { describe, it, expect } from 'vitest'
import { validateCustomerCredit } from '../customerCredit'
import type { Customer } from '@/types/database'

describe('Sistema de Crédito por Cliente', () => {
  const baseCustomer: Customer = {
    id: 'cust-1',
    business_id: 'biz-1',
    name: 'Juan Pérez',
    phone: '11223344',
    email: 'juan@test.com',
    address: 'Av Siempre Viva 123',
    doc_tipo: 'DNI',
    doc_nro: '30123456',
    iva_condition: 'consumidor_final',
    balance: 80000,
    credit_enabled: true,
    credit_limit: 100000,
    credit_unlimited: false,
    credit_terms_days: 30,
    credit_status: 'normal',
    created_at: new Date().toISOString(),
  }

  it('validates test case from spec: limit $100.000, debt $80.000, new sale $30.000 -> blocks without auth', () => {
    const res = validateCustomerCredit(baseCustomer, 30000)
    expect(res.allowed).toBe(false)
    expect(res.requiresAuth).toBe(true)
    expect(res.availableCredit).toBe(20000)
    expect(res.reason).toContain('excede el límite de crédito disponible por $10.000')
  })

  it('allows purchase when within available limit ($15.000)', () => {
    const res = validateCustomerCredit(baseCustomer, 15000)
    expect(res.allowed).toBe(true)
    expect(res.requiresAuth).toBe(false)
    expect(res.availableCredit).toBe(20000)
    expect(res.projectedBalance).toBe(95000)
  })

  it('allows override when manager or admin authorizes the exceeded credit', () => {
    const res = validateCustomerCredit(baseCustomer, 30000, {
      isManagerOrAdmin: true,
      bypassWithAuth: true,
    })
    expect(res.allowed).toBe(true)
    expect(res.requiresAuth).toBe(true)
  })

  it('handles unlimited credit customer', () => {
    const unlimitedCustomer: Customer = {
      ...baseCustomer,
      credit_unlimited: true,
      credit_limit: 0,
    }
    const res = validateCustomerCredit(unlimitedCustomer, 1000000)
    expect(res.allowed).toBe(true)
    expect(res.requiresAuth).toBe(false)
    expect(res.availableCredit).toBe(Infinity)
  })

  it('blocks customer when credit is not enabled', () => {
    const disabledCustomer: Customer = {
      ...baseCustomer,
      credit_enabled: false,
    }
    const res = validateCustomerCredit(disabledCustomer, 5000)
    expect(res.allowed).toBe(false)
    expect(res.requiresAuth).toBe(true)
    expect(res.reason).toContain('no tiene habilitada cuenta corriente')
  })

  it('blocks customer with credit_status = blocked', () => {
    const blockedCustomer: Customer = {
      ...baseCustomer,
      credit_status: 'blocked',
    }
    const res = validateCustomerCredit(blockedCustomer, 5000)
    expect(res.allowed).toBe(false)
    expect(res.reason).toContain('crédito bloqueado')
  })
})


import { describe, it, expect } from 'vitest'
import { executeAccountTransfer, applyExpenseToAccount } from '../financeService'
import type { FinancialAccount, Expense } from '@/types/database'

describe('Gestión Financiera y Cuentas', () => {
  const caja: FinancialAccount = {
    id: 'acc-1',
    business_id: 'biz-1',
    name: 'Caja Principal',
    type: 'cash',
    currency: 'ARS',
    balance: 50000,
    is_default: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mercadoPago: FinancialAccount = {
    id: 'acc-2',
    business_id: 'biz-1',
    name: 'Mercado Pago',
    type: 'wallet',
    currency: 'ARS',
    balance: 20000,
    is_default: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const cuentaUSD: FinancialAccount = {
    id: 'acc-3',
    business_id: 'biz-1',
    name: 'Efectivo USD',
    type: 'cash',
    currency: 'USD',
    balance: 1000,
    is_default: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('transfers money between accounts with exact balances and movements', () => {
    // Caja -> Mercado Pago: $15.000
    const result = executeAccountTransfer(caja, mercadoPago, 15000)
    expect(result.fromAccount.balance).toBe(35000)
    expect(result.toAccount.balance).toBe(35000)

    expect(result.outMovement.kind).toBe('transfer_out')
    expect(result.outMovement.amount).toBe(-15000)

    expect(result.inMovement.kind).toBe('transfer_in')
    expect(result.inMovement.amount).toBe(15000)
  })

  it('supports currency conversion on transfer (USD -> ARS)', () => {
    // 100 USD -> ARS con TC 1500 -> 150.000 ARS
    const result = executeAccountTransfer(cuentaUSD, caja, 100, 1500)
    expect(result.fromAccount.balance).toBe(900)
    expect(result.toAccount.balance).toBe(200000) // 50000 + 150000
    expect(result.inMovement.amount).toBe(150000)
  })

  it('throws error when balance is insufficient', () => {
    expect(() => executeAccountTransfer(caja, mercadoPago, 80000)).toThrow('Saldo insuficiente')
  })

  it('applies expense to financial account reducing its balance', () => {
    const expense: Expense = {
      id: 'exp-1',
      business_id: 'biz-1',
      category_id: 'cat-1',
      supplier_id: null,
      financial_account_id: 'acc-1',
      date: '2026-10-30',
      description: 'Factura de luz Edenor',
      amount: 12000,
      currency: 'ARS',
      exchange_rate: 1,
      amount_converted: 12000,
      payment_method: 'cash',
      voucher_number: null,
      attachment_url: null,
      is_recurring: false,
      recurrence_period: null,
      status: 'paid',
      notes: null,
      user_id: null,
      created_at: new Date().toISOString(),
    }

    const res = applyExpenseToAccount(caja, expense)
    expect(res.updatedAccount.balance).toBe(38000)
    expect(res.movement.amount).toBe(-12000)
    expect(res.movement.kind).toBe('expense')
  })
})


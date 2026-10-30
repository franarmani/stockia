import type { Customer } from '@/types/database'

export interface CreditValidationResult {
  allowed: boolean
  requiresAuth: boolean
  reason?: string
  creditEnabled: boolean
  isUnlimited: boolean
  creditLimit: number
  currentBalance: number
  availableCredit: number
  projectedBalance: number
}

/**
 * Valida si un cliente puede comprar a crédito por el importe especificado.
 * balance > 0 representa deuda actual del cliente.
 */
export function validateCustomerCredit(
  customer: Customer | null | undefined,
  saleAmount: number,
  options?: { isManagerOrAdmin?: boolean; bypassWithAuth?: boolean }
): CreditValidationResult {
  const amount = Math.max(0, Number(saleAmount) || 0)

  // Sin cliente seleccionado
  if (!customer) {
    return {
      allowed: false,
      requiresAuth: true,
      reason: 'Se requiere seleccionar un cliente para vender a crédito o cuenta corriente.',
      creditEnabled: false,
      isUnlimited: false,
      creditLimit: 0,
      currentBalance: 0,
      availableCredit: 0,
      projectedBalance: amount,
    }
  }

  const creditEnabled = Boolean(customer.credit_enabled)
  const isUnlimited = Boolean(customer.credit_unlimited)
  const creditLimit = Math.max(0, Number(customer.credit_limit) || 0)
  const currentBalance = Number(customer.balance) || 0
  const projectedBalance = currentBalance + amount

  // Cliente bloqueado explícitamente
  if (customer.credit_status === 'blocked') {
    return {
      allowed: Boolean(options?.bypassWithAuth && options?.isManagerOrAdmin),
      requiresAuth: true,
      reason: 'El cliente tiene el crédito bloqueado por administración.',
      creditEnabled,
      isUnlimited,
      creditLimit,
      currentBalance,
      availableCredit: 0,
      projectedBalance,
    }
  }

  // Crédito no habilitado
  if (!creditEnabled) {
    const canBypass = Boolean(options?.bypassWithAuth && options?.isManagerOrAdmin)
    return {
      allowed: canBypass,
      requiresAuth: true,
      reason: 'El cliente no tiene habilitada cuenta corriente / crédito.',
      creditEnabled,
      isUnlimited,
      creditLimit,
      currentBalance,
      availableCredit: 0,
      projectedBalance,
    }
  }

  // Crédito sin límite
  if (isUnlimited) {
    return {
      allowed: true,
      requiresAuth: false,
      creditEnabled: true,
      isUnlimited: true,
      creditLimit: Infinity,
      currentBalance,
      availableCredit: Infinity,
      projectedBalance,
    }
  }

  // Crédito con límite establecido
  const availableCredit = Math.max(0, creditLimit - currentBalance)

  if (projectedBalance > creditLimit) {
    const excess = projectedBalance - creditLimit
    const canBypass = Boolean(options?.bypassWithAuth && options?.isManagerOrAdmin)
    return {
      allowed: canBypass,
      requiresAuth: true,
      reason: `La venta excede el límite de crédito disponible por $${excess.toLocaleString('es-AR')}. Límite: $${creditLimit.toLocaleString('es-AR')}, Utilizado: $${currentBalance.toLocaleString('es-AR')}, Disponible: $${availableCredit.toLocaleString('es-AR')}.`,
      creditEnabled: true,
      isUnlimited: false,
      creditLimit,
      currentBalance,
      availableCredit,
      projectedBalance,
    }
  }

  return {
    allowed: true,
    requiresAuth: false,
    creditEnabled: true,
    isUnlimited: false,
    creditLimit,
    currentBalance,
    availableCredit,
    projectedBalance,
  }
}


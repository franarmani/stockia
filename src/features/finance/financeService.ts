import type { FinancialAccount, FinancialMovement, Expense } from '@/types/database'

export interface TransferResult {
  fromAccount: FinancialAccount
  toAccount: FinancialAccount
  outMovement: Partial<FinancialMovement>
  inMovement: Partial<FinancialMovement>
}

/**
 * Realiza una transferencia entre dos cuentas financieras (ej. Caja -> Mercado Pago o USD -> ARS)
 * garantizando trazabilidad, sin duplicar ni perder movimientos.
 */
export function executeAccountTransfer(
  fromAccount: FinancialAccount,
  toAccount: FinancialAccount,
  amount: number,
  exchangeRate: number = 1,
  notes?: string
): TransferResult {
  if (amount <= 0) {
    throw new Error('El importe a transferir debe ser mayor a cero.')
  }
  if (fromAccount.id === toAccount.id) {
    throw new Error('Las cuentas de origen y destino deben ser distintas.')
  }
  if (fromAccount.balance < amount) {
    throw new Error(`Saldo insuficiente en cuenta ${fromAccount.name}. Saldo: $${fromAccount.balance}, Solicitado: $${amount}`)
  }

  const transferredDestinationAmount = Math.round(amount * exchangeRate * 100) / 100

  const updatedFrom: FinancialAccount = {
    ...fromAccount,
    balance: Math.round((fromAccount.balance - amount) * 100) / 100,
    updated_at: new Date().toISOString(),
  }

  const updatedTo: FinancialAccount = {
    ...toAccount,
    balance: Math.round((toAccount.balance + transferredDestinationAmount) * 100) / 100,
    updated_at: new Date().toISOString(),
  }

  const transferGroup = crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}`

  const outMovement: Partial<FinancialMovement> = {
    business_id: fromAccount.business_id,
    financial_account_id: fromAccount.id,
    kind: 'transfer_out',
    origin_type: 'transfer',
    amount: -amount,
    currency: fromAccount.currency,
    exchange_rate: 1,
    amount_converted: -amount,
    description: `Transferencia hacia ${toAccount.name}${notes ? ` - ${notes}` : ''}`,
    created_at: new Date().toISOString(),
  }

  const inMovement: Partial<FinancialMovement> = {
    business_id: toAccount.business_id,
    financial_account_id: toAccount.id,
    kind: 'transfer_in',
    origin_type: 'transfer',
    amount: transferredDestinationAmount,
    currency: toAccount.currency,
    exchange_rate: exchangeRate,
    amount_converted: transferredDestinationAmount,
    description: `Transferencia recibida de ${fromAccount.name}${exchangeRate !== 1 ? ` (TC: ${exchangeRate})` : ''}${notes ? ` - ${notes}` : ''}`,
    created_at: new Date().toISOString(),
  }

  return {
    fromAccount: updatedFrom,
    toAccount: updatedTo,
    outMovement,
    inMovement,
  }
}

/**
 * Registra un gasto en la cuenta financiera correspondiente y descuenta su saldo.
 */
export function applyExpenseToAccount(
  account: FinancialAccount,
  expense: Expense
): { updatedAccount: FinancialAccount; movement: Partial<FinancialMovement> } {
  const updatedAccount: FinancialAccount = {
    ...account,
    balance: Math.round((account.balance - expense.amount) * 100) / 100,
    updated_at: new Date().toISOString(),
  }

  const movement: Partial<FinancialMovement> = {
    business_id: account.business_id,
    financial_account_id: account.id,
    kind: 'expense',
    origin_type: 'expense',
    origin_id: expense.id,
    amount: -expense.amount,
    currency: expense.currency,
    exchange_rate: expense.exchange_rate,
    amount_converted: -expense.amount_converted,
    description: `Gasto: ${expense.description}`,
    created_at: new Date().toISOString(),
  }

  return { updatedAccount, movement }
}


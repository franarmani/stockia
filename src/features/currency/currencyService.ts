export interface CurrencyOperation {
  currencyOriginal: string
  amountOriginal: number
  exchangeRate: number
  currencyBase: string
  amountConverted: number
}

/**
 * Registra una operación multimoneda calculando el importe base convertido
 * y asegurando que quede congelado para consultas históricas.
 */
export function recordCurrencyTransaction(
  amount: number,
  currency: string,
  exchangeRate: number,
  baseCurrency: string = 'ARS'
): CurrencyOperation {
  const amt = Number(amount) || 0
  const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1

  let amountConverted: number
  if (currency.toUpperCase() === baseCurrency.toUpperCase()) {
    amountConverted = amt
  } else {
    // Moneda extranjera a moneda base
    amountConverted = Math.round(amt * rate * 100) / 100
  }

  return {
    currencyOriginal: currency.toUpperCase(),
    amountOriginal: amt,
    exchangeRate: rate,
    currencyBase: baseCurrency.toUpperCase(),
    amountConverted,
  }
}

/**
 * Calcula el precio sugerido en ARS para un producto cotizado en moneda extranjera.
 */
export function calculateForeignPricedProduct(
  costForeign: number,
  exchangeRate: number,
  markupPercent?: number | null
): { costBase: number; suggestedPriceBase: number } {
  const cost = Number(costForeign) || 0
  const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1
  const costBase = Math.round(cost * rate * 100) / 100

  const markup = Number(markupPercent) || 0
  const suggestedPriceBase = Math.round(costBase * (1 + markup / 100) * 100) / 100

  return {
    costBase,
    suggestedPriceBase,
  }
}


export function toCents(value: string | number): number {
  const normalized = typeof value === 'number' ? value.toString() : value.replace(',', '.')
  const [integer = '0', decimals = ''] = normalized.split('.')
  const sign = integer.startsWith('-') ? -1 : 1
  const whole = Math.abs(Number(integer || 0)) * 100
  const fraction = Number((decimals + '00').slice(0, 2))
  return sign * (whole + fraction)
}

export function fromCents(value: number): string {
  return (value / 100).toFixed(2)
}

export function multiplyMoney(unitCost: string | number, quantity: string | number): number {
  const quantityThousandths = Math.round(Number(quantity) * 1000)
  return Math.round((toCents(unitCost) * quantityThousandths) / 1000)
}

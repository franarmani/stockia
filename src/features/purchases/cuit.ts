export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidCuit(value: string): boolean {
  const cuit = normalizeCuit(value)
  if (!/^\d{11}$/.test(cuit)) return false
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = multipliers.reduce((total, multiplier, index) => total + Number(cuit[index]) * multiplier, 0)
  const mod = 11 - (sum % 11)
  const verifier = mod === 11 ? 0 : mod === 10 ? 9 : mod
  return verifier === Number(cuit[10])
}

export function formatCuit(value: string): string {
  const cuit = normalizeCuit(value).slice(0, 11)
  if (cuit.length <= 2) return cuit
  if (cuit.length <= 10) return `${cuit.slice(0, 2)}-${cuit.slice(2)}`
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

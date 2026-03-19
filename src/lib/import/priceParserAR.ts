/**
 * priceParserAR.ts
 * Parses Argentine number formats to JS numbers.
 * Handles: "1.234,56" → 1234.56 | "$1.200" → 1200 | "1200.50" → 1200.5
 */

export function parseNumberAR(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return isFinite(raw) ? raw : null

  let s = String(raw).trim()

  // Remove currency symbols, %, and surrounding whitespace
  s = s.replace(/[$%\s]/g, '')
  if (s === '' || s === '-') return null

  // Detect format: if has comma AND dot
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      // AR format: 1.234,56 → remove dots, replace comma with dot
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 1,234.56 → remove commas
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Only commas: could be thousands "1,200" or decimal "1,5"
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      // Treat as decimal separator
      s = s.replace(',', '.')
    } else {
      // Treat as thousands separator
      s = s.replace(/,/g, '')
    }
  }
  // else: only dots or plain number → parse directly

  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/** Parse a boolean-like value: "si","yes","1","true" → true | "no","0","false" → false */
export function parseBooleanAR(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  const s = String(raw).toLowerCase().trim()
  if (['1', 'true', 'si', 'sí', 'yes', 'activo', 'habilitado', 'y'].includes(s)) return true
  if (['0', 'false', 'no', 'inactivo', 'deshabilitado', 'n'].includes(s)) return false
  return null
}

/** Clean a barcode string: remove spaces and non-printable chars */
export function parseBarcode(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const s = String(raw).trim().replace(/\s/g, '')
  return s || null
}

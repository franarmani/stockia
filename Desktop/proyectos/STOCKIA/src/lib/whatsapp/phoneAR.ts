/**
 * Argentine phone number normalisation for WhatsApp wa.me links.
 *
 * Rules:
 *  - Strip all non-digits
 *  - Remove leading 0 (local format)
 *  - Remove "15" mobile prefix after area code
 *  - Ensure E.164 Argentina: 54 + area + number
 *  - For wa.me (mobile): 549 + area + number
 *
 * Examples:
 *   011 15 1234-5678  → 5491112345678
 *   +54 9 11 12345678 → 5491112345678
 *   2614561234        → 5492614561234
 */

export function normalizeArPhone(raw: string, countryCode = '54'): string {
  let d = raw.replace(/\D/g, '')

  // Remove leading +
  if (d.startsWith('0')) d = d.slice(1)

  // If already starts with country code
  if (d.startsWith(countryCode)) {
    d = d.slice(countryCode.length)
  }

  // Remove 15 after area code (2-4 digit area codes)
  // Matches: 11 15 xxxx, 351 15 xxxx, 2944 15 xxxx
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')

  // Remove leading 9 if present (already in international format)
  if (d.startsWith('9')) d = d.slice(1)

  // Now d should be area + subscriber: e.g. 1112345678
  // Build wa.me format: 549 + number
  return `${countryCode}9${d}`
}

/** Validate that a normalised phone has reasonable length */
export function isValidArPhone(normalised: string): boolean {
  // Argentine mobile: 549 + 10 digits = 13 digits total
  return /^549\d{10}$/.test(normalised)
}

/** Pretty display of a normalised phone */
export function formatPhoneDisplay(normalised: string): string {
  // 5491112345678 → +54 9 11 1234-5678
  if (!normalised.startsWith('549')) return normalised
  const rest = normalised.slice(3)
  const area = rest.slice(0, 2)
  const num = rest.slice(2)
  const part1 = num.slice(0, 4)
  const part2 = num.slice(4)
  return `+54 9 ${area} ${part1}-${part2}`
}

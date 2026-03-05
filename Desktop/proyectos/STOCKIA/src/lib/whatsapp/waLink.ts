/**
 * WhatsApp link builder + send utilities.
 */

import { normalizeArPhone } from './phoneAR'

/** Build a wa.me link with pre-filled text */
export function buildWaLink(phone: string, message: string, countryCode = '54'): string {
  const normalised = normalizeArPhone(phone, countryCode)
  return `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`
}

/** Build a web.whatsapp.com link (alternative send mode) */
export function buildWebWaLink(phone: string, message: string, countryCode = '54'): string {
  const normalised = normalizeArPhone(phone, countryCode)
  return `https://web.whatsapp.com/send?phone=${normalised}&text=${encodeURIComponent(message)}`
}

/** Open WhatsApp. Returns false if popup was blocked. */
export function openWhatsApp(
  phone: string,
  message: string,
  mode: 'wa_me' | 'web' = 'wa_me',
  countryCode = '54'
): { success: boolean; url: string } {
  const url = mode === 'web'
    ? buildWebWaLink(phone, message, countryCode)
    : buildWaLink(phone, message, countryCode)

  const win = window.open(url, '_blank', 'noopener,noreferrer')
  return { success: !!win, url }
}

/**
 * CajaGo — Frescura de los datos locales
 *
 * Las pantallas leen siempre de la base local (instantáneo) y se actualizan desde el
 * servidor en segundo plano. La excepción: justo después de escribir en el servidor
 * (guardar una compra, editar un producto…) se lee del servidor durante unos segundos,
 * para que lo recién guardado aparezca sin esperar a la actualización en segundo plano.
 */

/** Tiempo durante el que, tras una escritura, se lee directo del servidor. */
export const READ_THROUGH_AFTER_WRITE_MS = 15_000

/** Funciones del servidor que solo leen: llamarlas no cuenta como escritura. */
const READ_ONLY_RPC = /^(get_|has_|i_have_|email_has_|verify_|top_selling_products|frequently_bought_together|linked_business_summaries)/

let lastRemoteWriteAt = 0

export function markRemoteWrite() {
  lastRemoteWriteAt = Date.now()
}

export function hadRecentRemoteWrite(now = Date.now()): boolean {
  return now - lastRemoteWriteAt < READ_THROUGH_AFTER_WRITE_MS
}

/** true si el pedido HTTP a la API REST de Supabase modifica datos. */
export function isRemoteWriteRequest(url: string, method: string): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return false
  const match = url.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/i)
  if (!match) return false
  if (match[1]) return !READ_ONLY_RPC.test(match[2])
  return true
}

/** Huella corta de un valor, para saber si lo que mandó el servidor cambió. */
export function fingerprint(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? ''
  // FNV-1a de 32 bits + largo: suficiente para detectar cambios, no es criptográfico.
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`
}


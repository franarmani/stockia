// Qué hay detrás de un código escaneado (barras o QR) y a qué producto corresponde.
// Todo se resuelve con los productos DEL NEGOCIO ACTUAL que ya están en el equipo: sirve sin internet
// y un código/QR de otro comercio no encuentra nada (nunca se consulta por id suelto en el servidor).

import { PUBLIC_WEB_URL } from '@/config/publicUrls'

export interface ScannableProduct {
  id: string
  name: string
  barcode?: string | null
  code?: string | null
  active?: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Contenido del QR de un producto: un link que también abre CajaGo si se escanea con la cámara del celular. */
export function productQrValue(productId: string): string {
  return `${PUBLIC_WEB_URL}/p/${productId}`
}

export type ParsedScan = { kind: 'product-id'; id: string } | { kind: 'code'; value: string }

/** Distingue el QR de un producto de CajaGo de un código de barras o código propio cualquiera. */
export function parseScan(raw: string): ParsedScan | null {
  const text = String(raw ?? '').trim()
  if (!text) return null

  const url = /^https?:\/\/[^/\s]+\/p\/([0-9a-f-]{36})\/?(?:[?#].*)?$/i.exec(text)
  if (url && UUID.test(url[1])) return { kind: 'product-id', id: url[1].toLowerCase() }
  const scheme = /^cajago:p:([0-9a-f-]{36})$/i.exec(text)
  if (scheme && UUID.test(scheme[1])) return { kind: 'product-id', id: scheme[1].toLowerCase() }

  return { kind: 'code', value: text }
}

/** Busca el producto en la lista del negocio: por id (QR), código de barras o código propio. */
export function findScannedProduct<T extends ScannableProduct>(raw: string, products: T[]): { product: T | null; code: string; isProductLink: boolean } {
  const parsed = parseScan(raw)
  if (!parsed) return { product: null, code: '', isProductLink: false }
  const active = products.filter((p) => p.active !== false)

  if (parsed.kind === 'product-id') {
    return { product: active.find((p) => p.id.toLowerCase() === parsed.id) ?? null, code: parsed.id, isProductLink: true }
  }
  const value = parsed.value
  const lower = value.toLowerCase()
  // Algunos lectores agregan ceros adelante (EAN-13 leído como UPC-A): se prueba también sin ellos.
  const stripped = value.replace(/^0+/, '')
  const product =
    active.find((p) => p.barcode && p.barcode.trim() === value) ??
    active.find((p) => p.code && p.code.trim().toLowerCase() === lower) ??
    (stripped.length >= 6 ? active.find((p) => p.barcode && p.barcode.trim().replace(/^0+/, '') === stripped) : undefined) ??
    null
  return { product, code: value, isProductLink: false }
}

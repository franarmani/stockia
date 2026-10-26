// Integración con Tiendanube compartida entre funciones (sin APIs de Deno, así se prueba con vitest).

export const TN_API = 'https://api.tiendanube.com/2025-03'
export const TN_AUTH = 'https://www.tiendanube.com/apps'
export const TN_USER_AGENT = 'CajaGo (https://cajago.vercel.app)'

export type TnVariant = { tn_product_id: number; tn_variant_id: number; name: string; sku: string | null; barcode: string | null }
export type LocalProduct = { id: string; barcode: string | null }

/** Códigos comparables: sin espacios ni diferencias de mayúsculas. */
export function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

/** Nombre legible de una variante: "Remera · Rojo / M". */
export function variantName(product: any, variant: any): string {
  const pick = (value: any) => typeof value === 'string' ? value : value?.es ?? Object.values(value ?? {})[0] ?? ''
  const base = pick(product?.name) || `Producto ${product?.id}`
  const values = (variant?.values ?? []).map(pick).filter(Boolean)
  return values.length ? `${base} · ${values.join(' / ')}` : base
}

export function flattenVariants(products: any[]): TnVariant[] {
  return products.flatMap(product => (product?.variants ?? []).map((variant: any) => ({
    tn_product_id: Number(product.id),
    tn_variant_id: Number(variant.id),
    name: variantName(product, variant),
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
  })))
}

/** Empareja cada variante de Tiendanube con el producto de CajaGo que tiene ese código (SKU o código de barras). */
export function matchVariants(variants: TnVariant[], products: LocalProduct[]) {
  const byCode = new Map<string, string>()
  for (const product of products) {
    const code = normalizeCode(product.barcode)
    if (code && !byCode.has(code)) byCode.set(code, product.id)
  }
  const links: Array<{ product_id: string; tn_product_id: number; tn_variant_id: number }> = []
  const unmatched: TnVariant[] = []
  for (const variant of variants) {
    const productId = byCode.get(normalizeCode(variant.sku)) ?? byCode.get(normalizeCode(variant.barcode))
    if (productId) links.push({ product_id: productId, tn_product_id: variant.tn_product_id, tn_variant_id: variant.tn_variant_id })
    else unmatched.push(variant)
  }
  return { links, unmatched }
}

/** Líneas de un pedido de Tiendanube con el producto de CajaGo vinculado (null si la variante no está vinculada). */
export function orderLines(order: any, productByVariant: Map<number, string>) {
  return (order?.products ?? []).map((item: any) => ({
    product_id: productByVariant.get(Number(item.variant_id)) ?? null,
    tn_variant_id: Number(item.variant_id),
    name: String(item.name ?? '').slice(0, 200),
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
  }))
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Tiendanube firma cada webhook con HMAC-SHA256 (hex) del cuerpo crudo usando el secreto de la app. */
export async function verifyTiendanubeHmac(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  const given = signature.trim().toLowerCase()
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

/** Llamada a la API de una tienda. Devuelve la respuesta cruda para que el que llama decida (429, 404...). */
export function tnFetch(storeId: number | string, token: string, path: string, init: RequestInit = {}) {
  return fetch(`${TN_API}/${storeId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': TN_USER_AGENT,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

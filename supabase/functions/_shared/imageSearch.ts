// Búsqueda de fotos de producto en internet (sin APIs de Deno: se prueba con vitest).

export interface ImageResult {
  url: string
  thumbnail: string
  width: number
  height: number
  title: string
  source: string | null
}

/** Siempre se buscan fotos de producto con fondo blanco. */
export function buildImageQuery(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 100)
  return `${clean} producto fondo blanco`
}

export function parseGoogleImages(data: any): ImageResult[] {
  const items = Array.isArray(data?.items) ? data.items : []
  return items.flatMap((item: any) => {
    const url = String(item?.link ?? '')
    const thumbnail = String(item?.image?.thumbnailLink ?? url)
    if (!isSafeImageUrl(url) || !/^https:\/\//.test(thumbnail)) return []
    return [{
      url,
      thumbnail,
      width: Number(item?.image?.width) || 0,
      height: Number(item?.image?.height) || 0,
      title: String(item?.title ?? '').slice(0, 120),
      source: typeof item?.image?.contextLink === 'string' ? item.image.contextLink : null,
    }]
  })
}

const BLOCKED_HOSTS = /^(localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i

/** Solo https a un nombre de dominio público (nada de IPs ni redes internas). */
export function isSafeImageUrl(raw: string): boolean {
  let url: URL
  try { url = new URL(raw) } catch { return false }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false
  const host = url.hostname
  if (!host.includes('.') || BLOCKED_HOSTS.test(host)) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  return true
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

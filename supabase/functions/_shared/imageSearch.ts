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

const decodeEntities = (text: string) =>
  text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Resultados de la página de imágenes de Bing (cada foto trae un JSON en el atributo m="..."). */
export function parseBingImages(html: string): ImageResult[] {
  const results: ImageResult[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/class="iusc"[^>]*?\sm="([^"]+)"/g)) {
    let data: any
    try { data = JSON.parse(decodeEntities(match[1])) } catch { continue }
    const url = String(data?.murl ?? '')
    const thumbnail = String(data?.turl ?? '')
    if (!isSafeImageUrl(url) || !/^https:\/\//.test(thumbnail) || seen.has(url)) continue
    seen.add(url)
    results.push({ url, thumbnail, width: 0, height: 0, title: String(data?.t ?? '').replace(/[-]/g, '').slice(0, 120), source: typeof data?.purl === 'string' ? data.purl : null })
  }
  return results
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

type MatchProduct = { id: string; name: string; barcode?: string | null }

const words = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)\s*(kg|kgs|g|gr|lt|l|ml|cm|mm|m)\b/g, '$1$2')
    .split(/[^a-z0-9]+/).filter((w) => w.length > 1 && w !== 'x')

/** Busca el producto de un renglón de factura: por código exacto o por nombre parecido. */
export function matchInvoiceItem<T extends MatchProduct>(item: { description: string; code: string | null }, products: T[]): T | null {
  const code = item.code?.trim().toLowerCase()
  if (code) {
    const byCode = products.find((p) => p.barcode?.trim().toLowerCase() === code)
    if (byCode) return byCode
  }
  const target = new Set(words(item.description))
  if (target.size === 0) return null
  let best: { product: T; score: number } | null = null
  for (const product of products) {
    const candidate = new Set(words(product.name))
    if (candidate.size === 0) continue
    let shared = 0
    for (const word of target) if (candidate.has(word)) shared++
    const score = shared / Math.max(target.size, candidate.size)
    if (score > (best?.score ?? 0)) best = { product, score }
  }
  return best && best.score >= 0.5 ? best.product : null
}

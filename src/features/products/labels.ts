// Etiquetas de góndola con código de barras (hoja A4 o rollo de impresora térmica).

export interface LabelProduct {
  id: string
  name: string
  sale_price: number
  barcode: string | null
}

export type LabelFormat = 'a4' | 'thermal'

export interface LabelOptions {
  format: LabelFormat
  showPrice: boolean
  businessName?: string
}

/** EAN-13 solo si el código es válido (dígito verificador); cualquier otro texto va en Code 128. */
export function barcodeFormat(code: string | null | undefined): 'EAN13' | 'CODE128' | null {
  const value = (code ?? '').trim()
  if (!value) return null
  if (/^\d{13}$/.test(value)) {
    const digits = value.split('').map(Number)
    const sum = digits.slice(0, 12).reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
    if ((10 - (sum % 10)) % 10 === digits[12]) return 'EAN13'
  }
  return 'CODE128'
}

export function expandLabels(entries: Array<{ product: LabelProduct; copies: number }>): LabelProduct[] {
  return entries.flatMap(({ product, copies }) => Array.from({ length: Math.max(0, Math.floor(copies)) }, () => product))
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

async function barcodeSvg(code: string, format: 'EAN13' | 'CODE128', height: number): Promise<string> {
  const { default: JsBarcode } = await import('jsbarcode')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, code, { format, height, width: 1.6, fontSize: 11, margin: 0, displayValue: true })
  return svg.outerHTML
}

export async function buildLabelsHtml(labels: LabelProduct[], options: LabelOptions): Promise<string> {
  const thermal = options.format === 'thermal'
  const cells: string[] = []
  for (const label of labels) {
    const format = barcodeFormat(label.barcode)
    const barcode = format ? await barcodeSvg(label.barcode!.trim(), format, thermal ? 34 : 38) : '<div class="nocode">Sin código</div>'
    const price = options.showPrice
      ? `<div class="price">$${Number(label.sale_price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`
      : ''
    cells.push(`<div class="label">
      ${options.businessName ? `<div class="biz">${escapeHtml(options.businessName)}</div>` : ''}
      <div class="name">${escapeHtml(label.name)}</div>
      ${price}
      <div class="code">${barcode}</div>
    </div>`)
  }

  const pageCss = thermal
    ? '@page { size: 50mm 25mm; margin: 0 } .sheet { display: block } .label { width: 50mm; height: 25mm; page-break-after: always; padding: 1.2mm 2mm }'
    : '@page { size: A4; margin: 8mm } .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm } .label { height: 33mm; border: 0.2mm dashed #bbb; padding: 2mm }'

  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
    * { box-sizing: border-box; margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000 }
    ${pageCss}
    .label { display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; break-inside: avoid; text-align: center }
    .biz { font-size: 7pt; color: #555 }
    .name { font-size: ${thermal ? 7.5 : 8.5}pt; font-weight: 700; line-height: 1.15; max-height: 2.4em; overflow: hidden }
    .price { font-size: ${thermal ? 11 : 14}pt; font-weight: 800 }
    .code svg { max-width: 100%; height: auto }
    .nocode { font-size: 7pt; color: #888 }
  </style></head><body><div class="sheet">${cells.join('')}</div></body></html>`
}

/** Imprime con un iframe oculto (funciona igual en el navegador y en el programa de escritorio). */
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentWindow!.document
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
    setTimeout(() => frame.remove(), 2000)
  }, 300)
}

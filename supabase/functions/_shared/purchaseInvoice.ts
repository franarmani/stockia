// Lectura de facturas de compra con IA (sin APIs de Deno: se prueba con vitest).

export interface InvoiceItem {
  description: string
  code: string | null
  quantity: number
  unit_cost: number
  vat_rate: number | null
}

export interface InvoiceData {
  supplier_name: string | null
  supplier_cuit: string | null
  letter: string | null
  point_of_sale: string | null
  number: string | null
  date: string | null
  total: number | null
  items: InvoiceItem[]
}

export const INVOICE_PROMPT = `Leé esta factura de compra argentina y devolvé SOLO un JSON con esta forma:
{"supplier_name": string|null, "supplier_cuit": string|null, "letter": "A"|"B"|"C"|null,
 "point_of_sale": string|null, "number": string|null, "date": "YYYY-MM-DD"|null, "total": number|null,
 "items": [{"description": string, "code": string|null, "quantity": number, "unit_cost": number, "vat_rate": number|null}]}
Reglas: el proveedor es quien emite la factura (no el cliente). unit_cost es el precio unitario SIN IVA en facturas A
y con IVA incluido en B y C. vat_rate es la alícuota (21, 10.5, 27 o 0). code es el código o SKU del artículo si figura.
Los números van sin separador de miles y con punto decimal. No inventes renglones: si no se lee, no lo pongas.`

const num = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const clean = value.replace(/[^\d,.-]/g, '')
  if (!/\d/.test(clean)) return null
  // "1.234,56" (formato argentino) o "1234.56"
  const normalized = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
const text = (value: unknown, max = 120): string | null => {
  const s = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  return s ? s.slice(0, max) : null
}

export function parseInvoiceAnswer(content: unknown): InvoiceData | null {
  if (typeof content !== 'string') return null
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let raw: any
  try { raw = JSON.parse(content.slice(start, end + 1)) } catch { return null }
  if (!raw || typeof raw !== 'object') return null

  const items: InvoiceItem[] = (Array.isArray(raw.items) ? raw.items : []).slice(0, 200).flatMap((item: any) => {
    const description = text(item?.description, 160)
    const quantity = num(item?.quantity) ?? 1
    const unitCost = num(item?.unit_cost)
    if (!description || unitCost === null || unitCost < 0 || quantity <= 0) return []
    const vat = num(item?.vat_rate)
    return [{ description, code: text(item?.code, 40), quantity, unit_cost: Math.round(unitCost * 100) / 100, vat_rate: vat !== null && [0, 2.5, 5, 10.5, 21, 27].includes(vat) ? vat : null }]
  })
  const cuitDigits = String(raw.supplier_cuit ?? '').replace(/\D/g, '')
  const letter = String(raw.letter ?? '').trim().toUpperCase()
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null

  return {
    supplier_name: text(raw.supplier_name),
    supplier_cuit: cuitDigits.length === 11 ? cuitDigits : null,
    letter: ['A', 'B', 'C', 'M'].includes(letter) ? letter : null,
    point_of_sale: text(raw.point_of_sale, 5)?.replace(/\D/g, '') || null,
    number: text(raw.number, 8)?.replace(/\D/g, '') || null,
    date,
    total: num(raw.total),
    items,
  }
}

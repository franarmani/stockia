/**
 * Soporte para códigos de barra de balanzas comerciales (Sistel, Systel, Kretz, Moretti, Hasar, Toledo).
 * Estándar EAN-13 en Argentina (fiambrerías, carnicerías, verdulerías, panaderías).
 *
 * Formatos habituales (13 dígitos):
 * 1) Prefijo (2 dígitos): '20' (estándar balanza Sistel/Systel), '02', '28', '29', '21', '22'.
 * 2) PLU / Código de producto: 5 dígitos o 4 dígitos (ej. "00123" -> PLU 123).
 * 3) Peso / Importe: 5 dígitos.
 *    - En modo peso (estándar fiambrería): gramos (ej. 00450 = 0.450 kg).
 *    - En modo importe: centavos o pesos (ej. 04500 = $4500).
 */

export interface ParsedScaleBarcode {
  isScale: boolean
  raw: string
  prefix: string
  plu: string          // PLU limpio sin ceros a la izquierda (ej: "123")
  pluRaw: string       // PLU de 5 dígitos (ej: "00123")
  plu4Raw: string      // Alternativa PLU de 4 dígitos (ej: "0123")
  mode: 'weight' | 'price'
  weightKg: number     // Peso en kilogramos (ej: 0.450)
  amount?: number      // Importe total si la balanza emite precio
}

/**
 * Parsea un código de barras de balanza Sistel / Systel (EAN-13 de longitud 13 o 12 dígitos).
 */
export function parseSistelBarcode(raw: string): ParsedScaleBarcode | null {
  const code = String(raw ?? '').trim()
  if (!/^\d{12,13}$/.test(code)) return null

  // Normalizar a 13 dígitos
  let ean13 = code
  if (code.length === 12) {
    if (code.startsWith('20') || code.startsWith('02') || code.startsWith('28') || code.startsWith('29')) {
      ean13 = code + '0'
    } else if (code.startsWith('2')) {
      ean13 = '0' + code
    } else {
      return null
    }
  }

  const prefix = ean13.slice(0, 2)
  if (!['20', '02', '28', '29', '21', '22'].includes(prefix)) {
    return null
  }

  // Estructura EAN-13 Sistel estándar:
  // [0..1] Prefijo (2 dígitos, ej. "20")
  // [2..6] PLU (5 dígitos, ej. "00123")
  // [7..11] Peso en gramos (5 dígitos, ej. "00450")
  // [12] Checksum (1 dígito)
  const pluRaw = ean13.slice(2, 7)
  const pluClean = pluRaw.replace(/^0+/, '') || '0'
  const plu4Raw = ean13.slice(2, 6)

  const weightGramsRaw = ean13.slice(7, 12)
  const weightGrams = parseInt(weightGramsRaw, 10)
  const weightKg = Math.round((weightGrams / 1000) * 1000) / 1000

  return {
    isScale: true,
    raw: code,
    prefix,
    plu: pluClean,
    pluRaw,
    plu4Raw,
    mode: 'weight',
    weightKg: weightKg > 0 ? weightKg : 1,
  }
}

export interface ScannableWithScale {
  id: string
  name: string
  barcode?: string | null
  code?: string | null
  active?: boolean
  unit?: string | null
  sale_price?: number
  stock?: number
}

export interface ScaleScanLookupResult<T> {
  product: T | null
  code: string
  isProductLink: boolean
  isScale: boolean
  scaleWeight?: number
  scalePlu?: string
}

/**
 * Busca un producto teniendo en cuenta códigos de balanza Sistel.
 * Si el código es de balanza Sistel, extrae el PLU y busca coincidencia con `code` o `barcode`.
 */
export function findProductWithScaleSupport<T extends ScannableWithScale>(
  raw: string,
  products: T[],
  defaultFind: (raw: string, products: T[]) => { product: T | null; code: string; isProductLink: boolean }
): ScaleScanLookupResult<T> {
  // Primero intentar detección de balanza Sistel
  const scale = parseSistelBarcode(raw)
  if (scale) {
    const active = products.filter((p) => p.active !== false)
    const pluClean = scale.plu.toLowerCase()
    const pluRaw = scale.pluRaw.toLowerCase()
    const plu4 = scale.plu4Raw.toLowerCase()

    // 1. Coincidencia por código interno (PLU)
    const matchByCode = active.find((p) => {
      const c = (p.code || '').trim().toLowerCase()
      return c === pluClean || c === pluRaw || c === plu4
    })
    if (matchByCode) {
      return {
        product: matchByCode,
        code: raw,
        isProductLink: false,
        isScale: true,
        scaleWeight: scale.weightKg,
        scalePlu: scale.plu,
      }
    }

    // 2. Coincidencia por código de barras configurado como PLU o prefijo+PLU
    const matchByBarcode = active.find((p) => {
      const b = (p.barcode || '').trim().toLowerCase()
      return (
        b === pluClean ||
        b === pluRaw ||
        b === plu4 ||
        b === `${scale.prefix}${pluRaw}` ||
        b === `${scale.prefix}${pluClean}`
      )
    })
    if (matchByBarcode) {
      return {
        product: matchByBarcode,
        code: raw,
        isProductLink: false,
        isScale: true,
        scaleWeight: scale.weightKg,
        scalePlu: scale.plu,
      }
    }
  }

  // Si no es balanza o no se encontró por PLU, usar búsqueda estándar
  const standard = defaultFind(raw, products)
  return {
    ...standard,
    isScale: false,
  }
}


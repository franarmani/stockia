import { describe, it, expect } from 'vitest'
import { parseSistelBarcode, findProductWithScaleSupport } from '../sistelScale'

describe('parseSistelBarcode', () => {
  it('detects a standard Sistel scale barcode (13 digits, prefix 20, 5-digit PLU, 5-digit weight)', () => {
    // 20 (prefix) 00123 (PLU 123) 00450 (450g = 0.450kg) 5 (checksum)
    const result = parseSistelBarcode('2000123004505')
    expect(result).not.toBeNull()
    expect(result?.isScale).toBe(true)
    expect(result?.prefix).toBe('20')
    expect(result?.plu).toBe('123')
    expect(result?.pluRaw).toBe('00123')
    expect(result?.weightKg).toBe(0.45)
  })

  it('detects scale barcode with 1.250 kg weight', () => {
    // 20 00045 01250 8 -> PLU 45, 1250 grams = 1.25 kg
    const result = parseSistelBarcode('2000045012508')
    expect(result).not.toBeNull()
    expect(result?.plu).toBe('45')
    expect(result?.weightKg).toBe(1.25)
  })

  it('handles 12 digits barcode by normalising', () => {
    const result = parseSistelBarcode('200012300450')
    expect(result).not.toBeNull()
    expect(result?.plu).toBe('123')
    expect(result?.weightKg).toBe(0.45)
  })

  it('ignores standard commercial EAN-13 barcodes not starting with scale prefix', () => {
    // Standard Coca Cola or shampoo barcode (prefix 779 = Argentina commercial)
    const result = parseSistelBarcode('7791234567890')
    expect(result).toBeNull()
  })

  it('ignores invalid non-numeric strings', () => {
    expect(parseSistelBarcode('ABC1234567890')).toBeNull()
    expect(parseSistelBarcode('')).toBeNull()
  })
})

describe('findProductWithScaleSupport', () => {
  const dummyProducts = [
    { id: '1', name: 'Jamón Cocido', code: '123', unit: 'kg', active: true, sale_price: 10000, stock: 50 },
    { id: '2', name: 'Queso Tybo', code: '45', unit: 'kg', active: true, sale_price: 8000, stock: 30 },
    { id: '3', name: 'Gaseosa Cola 2L', barcode: '7791234567890', unit: 'u', active: true, sale_price: 2500, stock: 100 },
  ]

  const mockDefaultFind = (raw: string, products: typeof dummyProducts) => {
    const found = products.find((p) => p.code === raw || p.barcode === raw) ?? null
    return { product: found, code: raw, isProductLink: false }
  }

  it('finds deli product by PLU when Sistel scale barcode is scanned and returns exact weight', () => {
    const res = findProductWithScaleSupport('2000123004505', dummyProducts, mockDefaultFind)
    expect(res.isScale).toBe(true)
    expect(res.product?.id).toBe('1')
    expect(res.product?.name).toBe('Jamón Cocido')
    expect(res.scaleWeight).toBe(0.45)
  })

  it('falls back to standard lookup for non-scale barcodes', () => {
    const res = findProductWithScaleSupport('7791234567890', dummyProducts, mockDefaultFind)
    expect(res.isScale).toBe(false)
    expect(res.product?.id).toBe('3')
  })
})


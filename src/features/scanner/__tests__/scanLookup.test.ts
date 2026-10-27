import { describe, expect, it } from 'vitest'
import { findScannedProduct, parseScan, productQrValue } from '../scanLookup'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const products = [
  { id: A, name: 'Coca Cola 1,5 L', barcode: '7790895000010', code: '45' },
  { id: B, name: 'Yerba', barcode: '7790387000011', code: null },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Dado de baja', barcode: '999999', active: false },
]

describe('lectura de códigos', () => {
  it('el QR de un producto es un link con su id y se reconoce', () => {
    const qr = productQrValue(A)
    expect(qr).toMatch(/^https:\/\/.+\/p\/11111111-1111-4111-8111-111111111111$/)
    expect(parseScan(qr)).toEqual({ kind: 'product-id', id: A })
    expect(parseScan(`cajago:p:${A}`)).toEqual({ kind: 'product-id', id: A })
  })
  it('un código de barras o un texto cualquiera es un código', () => {
    expect(parseScan(' 7790895000010 ')).toEqual({ kind: 'code', value: '7790895000010' })
    expect(parseScan('https://otro.com/p/no-es-uuid')).toEqual({ kind: 'code', value: 'https://otro.com/p/no-es-uuid' })
    expect(parseScan('')).toBeNull()
  })
})

describe('buscar el producto escaneado', () => {
  it('por código de barras', () => {
    expect(findScannedProduct('7790895000010', products).product?.id).toBe(A)
  })
  it('por código propio (el "45" de la caja)', () => {
    expect(findScannedProduct('45', products).product?.id).toBe(A)
  })
  it('por QR', () => {
    expect(findScannedProduct(productQrValue(B), products).product?.id).toBe(B)
  })
  it('un QR de un producto que no es de este negocio no devuelve nada', () => {
    const foreign = productQrValue('99999999-9999-4999-8999-999999999999')
    expect(findScannedProduct(foreign, products)).toEqual({ product: null, code: '99999999-9999-4999-8999-999999999999', isProductLink: true })
  })
  it('un código inexistente devuelve el código para poder crear el producto', () => {
    expect(findScannedProduct('7791234567890', products)).toEqual({ product: null, code: '7791234567890', isProductLink: false })
  })
  it('no encuentra productos dados de baja', () => {
    expect(findScannedProduct('999999', products).product).toBeNull()
  })
  it('tolera ceros adelante del lector', () => {
    expect(findScannedProduct('07790895000010', products).product?.id).toBe(A)
  })
  it('no confunde un código corto con la coincidencia parcial de otro', () => {
    expect(findScannedProduct('4', products).product).toBeNull()
  })
})

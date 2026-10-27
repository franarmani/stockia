import { describe, expect, it } from 'vitest'
import { parseInvoiceAnswer } from '../../../../supabase/functions/_shared/purchaseInvoice'
import { matchInvoiceItem } from '../invoiceMatch'

describe('lectura de factura con IA', () => {
  it('normaliza la respuesta y descarta renglones inválidos', () => {
    const result = parseInvoiceAnswer(`Acá está: {"supplier_name":"Loma Negra SA","supplier_cuit":"30-50053085-1","letter":"a",
      "point_of_sale":"0003","number":"00012345","date":"2026-10-20","total":"1.234.567,89",
      "items":[{"description":"Cemento 50kg","code":"CEM50","quantity":"10","unit_cost":"9.850,50","vat_rate":21},
               {"description":"","quantity":1,"unit_cost":5},
               {"description":"Cal","quantity":2,"unit_cost":"abc"}]}`)
    expect(result).toMatchObject({
      supplier_name: 'Loma Negra SA', supplier_cuit: '30500530851', letter: 'A', point_of_sale: '0003', number: '00012345',
      date: '2026-10-20', total: 1234567.89,
    })
    expect(result?.items).toEqual([{ description: 'Cemento 50kg', code: 'CEM50', quantity: 10, unit_cost: 9850.5, vat_rate: 21 }])
  })
  it('devuelve null si no hay JSON', () => {
    expect(parseInvoiceAnswer('no pude leer nada')).toBeNull()
  })
})

describe('vincular renglones con productos', () => {
  const products = [
    { id: '1', name: 'Cemento Loma Negra 50 kg', barcode: 'CEM50' },
    { id: '2', name: 'Cal hidratada 25kg', barcode: null },
  ]
  it('primero por código', () => {
    expect(matchInvoiceItem({ description: 'algo', code: 'cem50' }, products)?.id).toBe('1')
  })
  it('después por nombre parecido', () => {
    expect(matchInvoiceItem({ description: 'CAL HIDRATADA X 25 KG', code: null }, products)?.id).toBe('2')
  })
  it('si no se parece a nada, queda sin vincular', () => {
    expect(matchInvoiceItem({ description: 'Arena fina', code: null }, products)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { flattenVariants, matchVariants, normalizeCode, orderLines, verifyTiendanubeHmac } from '../../../../supabase/functions/_shared/tiendanube'

describe('Tiendanube', () => {
  it('matches variants to CajaGo products by SKU or barcode, ignoring case and spaces', () => {
    const variants = flattenVariants([
      { id: 10, name: { es: 'Abrazadera' }, variants: [{ id: 101, sku: 'abr 10', barcode: null, values: [] }, { id: 102, sku: null, barcode: '779123', values: [{ es: 'Grande' }] }] },
      { id: 11, name: { es: 'Sin código' }, variants: [{ id: 111, sku: null, barcode: null, values: [] }] },
    ])
    const { links, unmatched } = matchVariants(variants, [{ id: 'p1', barcode: 'ABR10' }, { id: 'p2', barcode: '779123' }])
    expect(links).toEqual([
      { product_id: 'p1', tn_product_id: 10, tn_variant_id: 101 },
      { product_id: 'p2', tn_product_id: 10, tn_variant_id: 102 },
    ])
    expect(unmatched.map(v => v.name)).toEqual(['Sin código'])
    expect(variants[1].name).toBe('Abrazadera · Grande')
    expect(normalizeCode(' ab c ')).toBe('ABC')
  })

  it('maps order lines to linked products and keeps unlinked ones without product', () => {
    const lines = orderLines(
      { products: [{ variant_id: 101, name: 'Abrazadera', quantity: '2', price: '1500.00' }, { variant_id: 999, name: 'Otro', quantity: 1, price: '10' }] },
      new Map([[101, 'p1']]),
    )
    expect(lines).toEqual([
      { product_id: 'p1', tn_variant_id: 101, name: 'Abrazadera', quantity: 2, price: 1500 },
      { product_id: null, tn_variant_id: 999, name: 'Otro', quantity: 1, price: 10 },
    ])
  })

  it('accepts only webhooks signed with the app secret', async () => {
    const body = '{"store_id":1,"event":"order/paid","id":5}'
    const signature = createHmac('sha256', 'secreto').update(body).digest('hex')
    expect(await verifyTiendanubeHmac(body, signature, 'secreto')).toBe(true)
    expect(await verifyTiendanubeHmac(body + ' ', signature, 'secreto')).toBe(false)
    expect(await verifyTiendanubeHmac(body, signature, 'otro')).toBe(false)
    expect(await verifyTiendanubeHmac(body, null, 'secreto')).toBe(false)
  })
})

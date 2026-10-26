import { describe, expect, it } from 'vitest'
import { isValidSlug, orderMessage, validateOrder, whatsappOrderLink } from '../../../../supabase/functions/_shared/onlineStore'

const products = [
  { id: 'a', name: 'Yerba', sale_price: 3500, stock: 10, active: true, show_online: true },
  { id: 'b', name: 'Oculto', sale_price: 100, stock: 10, active: true, show_online: false },
]
const order = (overrides = {}) => ({ customer_name: 'Ana', customer_phone: '+54 291 555-1234', items: [{ product_id: 'a', quantity: 2, price: 1 }], ...overrides })

describe('online store orders', () => {
  it('prices orders from the database, never from the browser', () => {
    const result = validateOrder(order(), products)
    expect(result).toMatchObject({ ok: true, total: 7000, lines: [{ product_id: 'a', quantity: 2, price: 3500 }] })
  })

  it('rejects hidden products, bad quantities and missing contact data', () => {
    expect(validateOrder(order({ items: [{ product_id: 'b', quantity: 1 }] }), products)).toMatchObject({ ok: false })
    expect(validateOrder(order({ items: [{ product_id: 'zz', quantity: 1 }] }), products)).toMatchObject({ ok: false })
    expect(validateOrder(order({ items: [{ product_id: 'a', quantity: 0 }] }), products)).toMatchObject({ ok: false })
    expect(validateOrder(order({ items: [{ product_id: 'a', quantity: 5000 }] }), products)).toMatchObject({ ok: false })
    expect(validateOrder(order({ items: [] }), products)).toMatchObject({ ok: false })
    expect(validateOrder(order({ customer_name: '' }), products)).toMatchObject({ ok: false, error: 'Ingresá tu nombre' })
    expect(validateOrder(order({ customer_phone: 'llamame' }), products)).toMatchObject({ ok: false })
  })

  it('validates store slugs', () => {
    expect(isValidSlug('almacen-don-jose')).toBe(true)
    expect(isValidSlug('Almacen')).toBe(false)
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('../admin')).toBe(false)
  })

  it('builds the WhatsApp order message and link', () => {
    const text = orderMessage({ businessName: 'Kiosco', orderNumber: 7, customerName: 'Ana', customerPhone: '123456', notes: null, lines: [{ product_id: 'a', name: 'Yerba', quantity: 2, price: 3500 }], total: 7000 })
    expect(text).toContain('pedido #7')
    expect(text).toContain('2 × Yerba')
    expect(whatsappOrderLink('+54 9 291 571-6099', 'hola')).toBe('https://wa.me/5492915716099?text=hola')
    expect(whatsappOrderLink('', 'hola')).toBeNull()
  })
})

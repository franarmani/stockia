import { describe, expect, it } from 'vitest'
import { buildAlertMessage, daysUntil, expiryAlert, whatsappLink, whatsappNumber } from '../../../../supabase/functions/_shared/adminAlerts'

const business = {
  id: 'b1', name: 'Corralón <Sur>', phone: '291 555-1234', email: 'dueno@correo.com', city: 'Bahía Blanca', province: 'Buenos Aires',
  business_type: 'corralon', plan: 'vip', subscription_status: 'trial', trial_ends_at: '2026-11-03T15:00:00Z',
}

describe('número de WhatsApp', () => {
  it('arma el formato internacional argentino', () => {
    expect(whatsappNumber('291 555-1234')).toBe('5492915551234')
    expect(whatsappNumber('0291 15 555-1234')).toBe('5492915551234')
    expect(whatsappNumber('+54 9 291 555 1234')).toBe('5492915551234')
    expect(whatsappNumber('542915551234')).toBe('5492915551234')
  })
  it('sin número usable devuelve null', () => {
    expect(whatsappNumber('123')).toBeNull()
    expect(whatsappNumber(null)).toBeNull()
    expect(whatsappLink('', 'hola')).toBeNull()
  })
  it('el link lleva el mensaje codificado', () => {
    expect(whatsappLink('2915551234', 'Hola! Soy de CajaGo')).toBe('https://wa.me/5492915551234?text=Hola!%20Soy%20de%20CajaGo')
  })
})

describe('vencimientos', () => {
  const now = new Date('2026-10-31T13:00:00Z')
  it('cuenta días de calendario en hora argentina', () => {
    expect(daysUntil('2026-11-03T15:00:00Z', now)).toBe(3)
    expect(daysUntil('2026-10-31T23:00:00Z', now)).toBe(0)
    expect(daysUntil('2026-10-30T10:00:00Z', now)).toBe(-1)
    expect(daysUntil(null, now)).toBeNull()
  })
  it('avisa a los 3 días, 1 día y el mismo día; después avisa que venció', () => {
    expect(expiryAlert(3)).toEqual({ kind: 'por_vencer', step: 'd3' })
    expect(expiryAlert(1)).toEqual({ kind: 'por_vencer', step: 'd1' })
    expect(expiryAlert(0)).toEqual({ kind: 'por_vencer', step: 'd0' })
    expect(expiryAlert(-1)).toEqual({ kind: 'vencida', step: 'd-1' })
    expect(expiryAlert(-3)).toEqual({ kind: 'vencida', step: 'd-3' })
  })
  it('no avisa los demás días', () => {
    for (const days of [10, 5, 4, 2, -2, -4, -30]) expect(expiryAlert(days)).toBeNull()
    expect(expiryAlert(null)).toBeNull()
  })
})

describe('mensajes', () => {
  it('el registro incluye el WhatsApp del cliente y escapa el HTML', () => {
    const text = buildAlertMessage('registro', { business, ownerName: 'Ana Pérez' })
    expect(text).toContain('Nuevo registro')
    expect(text).toContain('Corralón &lt;Sur&gt;')
    expect(text).toContain('+5492915551234')
    expect(text).toContain('Ana Pérez')
    expect(text).toContain('dueno@correo.com')
  })
  it('sin teléfono lo aclara', () => {
    expect(buildAlertMessage('registro', { business: { ...business, phone: null } })).toContain('sin cargar')
  })
  it('compra: pago informado y suscripción de Mercado Pago', () => {
    const paid = buildAlertMessage('pago_informado', { business, extra: { amount: 110000, plan: 'vip' } })
    expect(paid).toContain('Quiere comprar')
    expect(paid).toContain('Plan VIP')
    expect(paid).toContain('$110.000')
    expect(buildAlertMessage('suscripcion_mp', { business, extra: { plan: 'premium' } })).toContain('Mercado Pago')
  })
  it('pago en USDT: importe, red y TXID', () => {
    const text = buildAlertMessage('pago_informado', { business, extra: { plan: 'vip', amount: 95, currency: 'USDT', network: 'TRC20', tx_hash: 'abc123' } })
    expect(text).toContain('USDT')
    expect(text).toContain('95 USDT (TRC20)')
    expect(text).toContain('<code>abc123</code>')
    expect(buildAlertMessage('pago_informado', { business, extra: { plan: 'vip', amount: 95, currency: 'USDT' } })).toContain('Sin TXID')
  })
  it('por vencer y vencida dicen cuánto falta', () => {
    expect(buildAlertMessage('por_vencer', { business, daysLeft: 3 })).toContain('vence en 3 días')
    expect(buildAlertMessage('por_vencer', { business, daysLeft: 1 })).toContain('vence mañana')
    expect(buildAlertMessage('por_vencer', { business, daysLeft: 0 })).toContain('vence HOY')
    expect(buildAlertMessage('por_vencer', { business, daysLeft: 3 })).toContain('Prueba gratis')
    expect(buildAlertMessage('por_vencer', { business: { ...business, subscription_status: 'active' }, daysLeft: 3 })).toContain('Mensualidad')
    expect(buildAlertMessage('vencida', { business })).toContain('bloqueada')
  })
})

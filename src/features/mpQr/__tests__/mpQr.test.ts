import { describe, expect, it } from 'vitest'
import { buildAuthorizationUrl, buildQrOrderBody, needsRefresh, qrOrderState, storeIds, toExternalReference } from '../../../../supabase/functions/_shared/mpQr'

describe('Mercado Pago QR payments', () => {
  it('builds the OAuth authorization link for the merchant', () => {
    const url = new URL(buildAuthorizationUrl('123', 'abc', 'https://x.supabase.co/functions/v1/mp-oauth-callback'))
    expect(url.origin + url.pathname).toBe('https://auth.mercadopago.com.ar/authorization')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '123', response_type: 'code', platform_id: 'mp', state: 'abc',
      redirect_uri: 'https://x.supabase.co/functions/v1/mp-oauth-callback',
    })
  })

  it('renews tokens a week before they expire', () => {
    const now = new Date('2026-10-28T00:00:00Z')
    expect(needsRefresh('2026-11-30T00:00:00Z', now)).toBe(false)
    expect(needsRefresh('2026-11-02T00:00:00Z', now)).toBe(true)
  })

  it('creates a single-use dynamic QR order with string amounts', () => {
    const body = buildQrOrderBody({ reference: 'f3b1c2d4-aaaa', amount: 1234.5, description: 'Compra en Kiosco', posExternalId: 'CAJAGOPOS1' })
    expect(body).toMatchObject({
      type: 'qr',
      external_reference: 'f3b1c2d4-aaaa',
      total_amount: '1234.50',
      config: { qr: { external_pos_id: 'CAJAGOPOS1', mode: 'dynamic' } },
      transactions: { payments: [{ amount: '1234.50' }] },
    })
    expect(body.items[0]).toMatchObject({ unit_price: '1234.50', quantity: 1, unit_measure: 'unit' })
  })

  it('keeps external references within Mercado Pago rules', () => {
    expect(toExternalReference('venta #12 / ñandú')).toBe('venta12and')
    expect(toExternalReference('x'.repeat(80))).toHaveLength(64)
  })

  it('maps order statuses to what the POS needs', () => {
    expect(qrOrderState({ status: 'created' })).toBe('pending')
    expect(qrOrderState({ status: 'processed' })).toBe('paid')
    expect(qrOrderState({ status: 'expired' })).toBe('expired')
    expect(qrOrderState(null)).toBe('pending')
  })

  it('derives stable store and POS ids per business', () => {
    expect(storeIds('57ad8b6b-474b-41ef-8248-4ccde558cb90')).toEqual({ storeExternalId: 'CAJAGO57AD8B6B474B41EF', posExternalId: 'CAJAGOPOS57AD8B6B474B41EF' })
  })
})

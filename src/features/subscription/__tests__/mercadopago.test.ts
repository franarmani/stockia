import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PLAN_PRICES, normalizePlan } from '@/config/plans'
import {
  PLAN_PRICES_ARS,
  approvedChargeFrom,
  buildPreapprovalBody,
  isSubscriptionPlan,
  isValidSignature,
  parseNotification,
  preapprovalIdFromPayment,
  signatureManifest,
  subscriptionAmount,
} from '../../../../supabase/functions/_shared/mercadopago'

describe('Mercado Pago subscriptions', () => {
  it('charges the plan price once per linked business', () => {
    expect(subscriptionAmount('basic', 0)).toBe(38000)
    expect(subscriptionAmount('premium', 0)).toBe(70000)
    expect(subscriptionAmount('premium', 1)).toBe(140000)
    expect(subscriptionAmount('basic', -3)).toBe(38000)
  })

  it('keeps server prices in sync with the plans shown in the app', () => {
    expect(PLAN_PRICES_ARS).toEqual(PLAN_PRICES)
    expect(isSubscriptionPlan('premium')).toBe(true)
    expect(isSubscriptionPlan('vip')).toBe(true)
    expect(isSubscriptionPlan('pro')).toBe(false)
  })

  it('keeps basic and vip, and treats legacy and empty plans as Premium', () => {
    expect(normalizePlan('basic')).toBe('basic')
    expect(normalizePlan('vip')).toBe('vip')
    for (const legacy of ['free', 'pro', 'premium', null, undefined]) expect(normalizePlan(legacy)).toBe('premium')
  })

  it('builds a pending monthly ARS preapproval tied to the business', () => {
    const body = buildPreapprovalBody({ businessId: 'biz', businessName: 'Corralón', payerEmail: 'a@b.com', plan: 'basic', amount: 38000, backUrl: 'https://x/suscripcion/listo' })
    expect(body.reason).toBe('CajaGo Básico · Corralón')
    expect(body).toMatchObject({
      external_reference: 'biz',
      payer_email: 'a@b.com',
      status: 'pending',
      back_url: 'https://x/suscripcion/listo',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 38000, currency_id: 'ARS' },
    })
  })

  it('reads webhook and legacy IPN notification formats', () => {
    expect(parseNotification(new URL('https://f/mp?type=subscription_preapproval&data.id=abc'), { type: 'subscription_preapproval', data: { id: 'abc' } }))
      .toEqual({ topic: 'subscription_preapproval', id: 'abc' })
    expect(parseNotification(new URL('https://f/mp?topic=payment&id=123'), null)).toEqual({ topic: 'payment', id: '123' })
    expect(parseNotification(new URL('https://f/mp'), {})).toBeNull()
  })

  it('validates the x-signature HMAC and rejects tampering', async () => {
    const secret = 'secreto'
    const manifest = signatureManifest('ABC123', 'req-1', '1700000000')
    expect(manifest).toBe('id:abc123;request-id:req-1;ts:1700000000;')
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex')

    const valid = { secret, signatureHeader: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123' }
    expect(await isValidSignature(valid)).toBe(true)
    expect(await isValidSignature({ ...valid, dataId: 'OTRO' })).toBe(false)
    expect(await isValidSignature({ ...valid, signatureHeader: null })).toBe(false)
    expect(await isValidSignature({ ...valid, secret: 'otro' })).toBe(false)
  })

  it('only counts monthly charges whose payment was approved', () => {
    expect(approvedChargeFrom({ transaction_amount: 70000, last_modified: '2026-11-01T10:00:00Z', payment: { id: 99, status: 'approved' } }))
      .toEqual({ paymentId: '99', amount: 70000, paidAt: '2026-11-01T10:00:00Z' })
    expect(approvedChargeFrom({ payment: { id: 99, status: 'rejected' } })).toBeNull()
    expect(approvedChargeFrom({ status: 'scheduled' })).toBeNull()
  })

  it('finds the subscription a payment belongs to', () => {
    expect(preapprovalIdFromPayment({ metadata: { preapproval_id: 'p1' } })).toBe('p1')
    expect(preapprovalIdFromPayment({ point_of_interaction: { transaction_data: { subscription_id: 'p2' } } })).toBe('p2')
    expect(preapprovalIdFromPayment({})).toBeNull()
  })
})

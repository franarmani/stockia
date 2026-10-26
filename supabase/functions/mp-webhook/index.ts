// Avisos de Mercado Pago (suscripciones y cobros). Público: Mercado Pago no manda JWT.
// Nunca se confía en el contenido del aviso: solo se usa el id para consultar a Mercado Pago
// con nuestro token, y si hay MP_WEBHOOK_SECRET además se valida la firma.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isValidSignature, parseNotification, preapprovalIdFromPayment } from '../_shared/mercadopago.ts'
import { mpFetch, syncPreapproval } from '../_shared/mpSync.ts'

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('ok', { status: 200 })

  const url = new URL(request.url)
  const body = await request.json().catch(() => null)
  const target = parseNotification(url, body)
  if (!target) return new Response('ignored', { status: 200 })

  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (secret) {
    const valid = await isValidSignature({
      secret,
      signatureHeader: request.headers.get('x-signature'),
      requestId: request.headers.get('x-request-id'),
      dataId: url.searchParams.get('data.id') ?? target.id,
    })
    if (!valid) return new Response('invalid signature', { status: 401 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (target.topic === 'subscription_preapproval' || target.topic === 'preapproval') {
      await syncPreapproval(admin, target.id)
    } else if (target.topic === 'subscription_authorized_payment' || target.topic === 'authorized_payment') {
      const authorizedPayment = await mpFetch(`/authorized_payments/${encodeURIComponent(target.id)}`)
      if (authorizedPayment?.preapproval_id) {
        await syncPreapproval(admin, String(authorizedPayment.preapproval_id), { authorizedPaymentId: target.id })
      }
    } else if (target.topic === 'payment') {
      const payment = await mpFetch(`/v1/payments/${encodeURIComponent(target.id)}`)
      const preapprovalId = preapprovalIdFromPayment(payment)
      if (preapprovalId) await syncPreapproval(admin, preapprovalId)
    }
    return new Response('ok', { status: 200 })
  } catch (error) {
    // 500 hace que Mercado Pago reintente el aviso más tarde.
    console.error('[mp-webhook]', target, error)
    return new Response('error', { status: 500 })
  }
})

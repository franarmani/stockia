// Suscripción mensual con Mercado Pago, llamada desde la app (usuario autenticado).
// Acciones: create (devuelve el link de pago), change_plan, sync (consulta estado y cobros), cancel.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildPreapprovalBody, isSubscriptionPlan, subscriptionAmount } from '../_shared/mercadopago.ts'
import { mpFetch, syncPreapproval } from '../_shared/mpSync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_BACK_URL = 'https://cajago.net/suscripcion/listo'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'No autorizado' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await admin.from('users').select('business_id, role').eq('id', user.id).maybeSingle()
    if (!profile?.business_id) return json({ error: 'Usuario sin negocio' }, 403)

    const { data: business } = await admin.from('businesses')
      .select('id, name, billing_group, mp_preapproval_id, mp_subscription_status')
      .eq('id', profile.business_id).single()
    if (!business) return json({ error: 'Negocio no encontrado' }, 404)

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')


    if (action === 'create') {
      if (profile.role !== 'admin') return json({ error: 'Solo un administrador puede activar la suscripción' }, 403)
      if (!isSubscriptionPlan(body?.plan)) return json({ error: 'Plan inválido' }, 400)
      if (business.mp_subscription_status === 'authorized') {
        return json({ error: 'Este negocio ya tiene una suscripción activa. Para cambiar de plan usá "Cambiar plan".' }, 409)
      }
      const payerEmail = String(body?.payer_email || user.email || '').trim().toLowerCase()
      if (!EMAIL_PATTERN.test(payerEmail)) return json({ error: 'Email de Mercado Pago inválido' }, 400)

      const amount = subscriptionAmount(body.plan)

      // Una suscripción pendiente anterior (checkout abandonado) se reemplaza por la nueva.
      if (business.mp_preapproval_id && business.mp_subscription_status === 'pending') {
        await mpFetch(`/preapproval/${encodeURIComponent(business.mp_preapproval_id)}`, {
          method: 'PUT', body: JSON.stringify({ status: 'cancelled' }),
        }).catch(error => console.warn('[mp-subscription] no se pudo cancelar la pendiente anterior:', error))
      }

      const preapproval = await mpFetch('/preapproval', {
        method: 'POST',
        body: JSON.stringify(buildPreapprovalBody({
          businessId: business.id,
          businessName: business.name,
          payerEmail,
          plan: body.plan,
          amount,
          backUrl: Deno.env.get('MP_BACK_URL') || DEFAULT_BACK_URL,
        })),
      })

      // El plan se aplica recién cuando Mercado Pago confirma el primer cobro.
      await admin.from('businesses').update({
        mp_preapproval_id: preapproval.id,
        mp_subscription_status: preapproval.status ?? 'pending',
        mp_payer_email: payerEmail,
        mp_plan: body.plan,
      }).eq('id', business.id)

      return json({ init_point: preapproval.init_point, preapproval_id: preapproval.id, amount })
    }

    if (action === 'change_plan') {
      if (profile.role !== 'admin') return json({ error: 'Solo un administrador puede cambiar el plan' }, 403)
      if (!isSubscriptionPlan(body?.plan)) return json({ error: 'Plan inválido' }, 400)
      if (business.mp_subscription_status !== 'authorized' || !business.mp_preapproval_id) {
        return json({ error: 'No hay una suscripción activa para cambiar' }, 409)
      }
      const amount = subscriptionAmount(body.plan)
      // Mercado Pago cobra el nuevo importe desde el próximo débito; el plan cambia ya.
      await mpFetch(`/preapproval/${encodeURIComponent(business.mp_preapproval_id)}`, {
        method: 'PUT',
        body: JSON.stringify({ auto_recurring: { transaction_amount: amount, currency_id: 'ARS' } }),
      })
      await admin.from('businesses').update({ plan: body.plan, mp_plan: body.plan }).eq('id', business.id)
      return json({ plan: body.plan, amount })
    }

    if (action === 'sync') {
      if (!business.mp_preapproval_id) return json({ status: null, applied: 0 })
      const result = await syncPreapproval(admin, business.mp_preapproval_id)
      return json({ status: result.status, applied: result.applied })
    }

    if (action === 'cancel') {
      if (profile.role !== 'admin') return json({ error: 'Solo un administrador puede cancelar la suscripción' }, 403)
      if (!business.mp_preapproval_id) return json({ error: 'No hay suscripción para cancelar' }, 404)
      await mpFetch(`/preapproval/${encodeURIComponent(business.mp_preapproval_id)}`, {
        method: 'PUT', body: JSON.stringify({ status: 'cancelled' }),
      })
      // Lo ya pagado se respeta: el acceso sigue hasta la fecha de vencimiento actual.
      await admin.from('businesses').update({ mp_subscription_status: 'cancelled', mp_next_payment_at: null }).eq('id', business.id)
      return json({ status: 'cancelled' })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[mp-subscription]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Panel admin (solo superadmin): asignar a un negocio una instancia de Z-API de la cuenta de CajaGo.
// El comercio después vincula SU propio número escaneando el QR desde CajaGo.
// Acciones: list, assign, unassign.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { setReceivedWebhook } from '../_shared/zapi.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
}

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
    const { data: profile } = await admin.from('users').select('is_superadmin').eq('id', user.id).maybeSingle()
    if (!profile?.is_superadmin) return json({ error: 'Solo el administrador de CajaGo' }, 403)

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (action === 'list') {
      const { data } = await admin.from('whatsapp_connections').select('business_id, instance_id, managed').not('instance_id', 'is', null)
      return json({ assigned: (data ?? []).map(row => ({ business_id: row.business_id, instance_id: row.instance_id, managed: row.managed })) })
    }

    const businessId = String(body?.business_id || '')
    const { data: business } = await admin.from('businesses').select('id').eq('id', businessId).maybeSingle()
    if (!business) return json({ error: 'Negocio no encontrado' }, 404)

    if (action === 'assign') {
      const instanceId = String(body?.instance_id ?? '').trim()
      const instanceToken = String(body?.instance_token ?? '').trim()
      const clientToken = String(body?.client_token ?? '').trim() || null
      if (!instanceId || !instanceToken) return json({ error: 'Completá el ID y el token de la instancia' }, 400)

      const { data: existing } = await admin.from('whatsapp_connections').select('webhook_key').eq('business_id', businessId).maybeSingle()
      const key = existing?.webhook_key ?? randomKey()
      const { data: saved, error } = await admin.from('whatsapp_connections').upsert({
        business_id: businessId, webhook_key: key, instance_id: instanceId, instance_token: instanceToken,
        client_token: clientToken, managed: false, subscribed: true, updated_at: new Date().toISOString(),
      }).select('*').single()
      if (error) throw new Error(error.message)

      // Los mensajes que reciba el número del comercio llegan a CajaGo.
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook?key=${key}`
      try {
        await setReceivedWebhook(saved, webhookUrl)
      } catch (webhookError) {
        console.error('[whatsapp-admin] webhook', webhookError)
        await admin.from('whatsapp_connections').update({ bot_enabled: false }).eq('business_id', businessId)
        throw new Error('La instancia se guardó, pero Z-API rechazó el webhook. Revisá el ID, token y Client-Token e intentá nuevamente.')
      }
      return json({ ok: true, webhook_configured: true })
    }

    if (action === 'unassign') {
      await admin.from('whatsapp_connections').update({
        instance_id: null, instance_token: null, client_token: null, managed: false, subscribed: false, bot_enabled: false, updated_at: new Date().toISOString(),
      }).eq('business_id', businessId)
      return json({ ok: true })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[whatsapp-admin]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Administración de WhatsApp con IA desde CajaGo (usuario autenticado).
// Acciones: get_config, save_config, send, pause, resume, mark_read.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess, INACTIVE_MESSAGE } from '../_shared/access.ts'
import { STAFF_PAUSE_HOURS } from '../_shared/whatsappBot.ts'
import { hasCredentials, instanceStatus, sendText, setReceivedWebhook } from '../_shared/zapi.ts'

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
    const { data: profile } = await admin.from('users').select('business_id, role').eq('id', user.id).maybeSingle()
    if (!profile?.business_id) return json({ error: 'Usuario sin negocio' }, 403)
    const businessId = profile.business_id as string
    if (!(await businessIsActive(admin, businessId))) return json({ error: INACTIVE_MESSAGE }, 403)
    const isAdmin = profile.role === 'admin'

    const { data: business } = await admin.from('businesses').select('plan, subscription_status').eq('id', businessId).single()
    if (!hasVipAccess(business)) {
      return json({ error: 'WhatsApp con IA es parte del plan VIP' }, 403)
    }

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')
    let { data: connection } = await admin.from('whatsapp_connections').select('*').eq('business_id', businessId).maybeSingle()
    const webhookUrl = (key: string) => `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook?key=${key}`

    if (action === 'get_config') {
      let connected: boolean | null = null
      if (hasCredentials(connection)) {
        connected = await instanceStatus(connection).then(s => !!s?.connected).catch(() => false)
      }
      return json({
        has_credentials: hasCredentials(connection),
        instance_id: connection?.instance_id ?? '',
        bot_enabled: !!connection?.bot_enabled,
        bot_instructions: connection?.bot_instructions ?? '',
        webhook_url: connection ? webhookUrl(connection.webhook_key) : null,
        connected,
      })
    }

    if (action === 'save_config') {
      if (!isAdmin) return json({ error: 'Solo un administrador puede configurar WhatsApp' }, 403)
      const values: Record<string, unknown> = {
        bot_enabled: body.bot_enabled === true,
        bot_instructions: String(body.bot_instructions ?? '').slice(0, 3000) || null,
        updated_at: new Date().toISOString(),
      }
      // Los tokens solo se reemplazan si se escriben de nuevo (nunca se devuelven a la app).
      if (typeof body.instance_id === 'string' && body.instance_id.trim()) values.instance_id = body.instance_id.trim()
      if (typeof body.instance_token === 'string' && body.instance_token.trim()) values.instance_token = body.instance_token.trim()
      if (typeof body.client_token === 'string' && body.client_token.trim()) values.client_token = body.client_token.trim()

      const key = connection?.webhook_key ?? randomKey()
      const { data: saved, error } = await admin.from('whatsapp_connections')
        .upsert({ business_id: businessId, webhook_key: key, ...values })
        .select('*').single()
      if (error) throw new Error(error.message)
      connection = saved

      let webhookConfigured = false
      let connected = false
      if (hasCredentials(connection)) {
        webhookConfigured = await setReceivedWebhook(connection, webhookUrl(key)).then(() => true).catch(() => false)
        connected = await instanceStatus(connection).then(s => !!s?.connected).catch(() => false)
      }
      return json({ ok: true, webhook_url: webhookUrl(key), webhook_configured: webhookConfigured, connected })
    }

    const phone = String(body?.phone ?? '').replace(/\D/g, '')
    if (phone.length < 8) return json({ error: 'Teléfono inválido' }, 400)

    if (action === 'send') {
      const text = String(body?.message ?? '').trim()
      if (!text || text.length > 4000) return json({ error: 'Escribí un mensaje' }, 400)
      if (!hasCredentials(connection)) return json({ error: 'Configurá primero la instancia de Z-API' }, 409)
      await sendText(connection, phone, text)
      await admin.from('whatsapp_messages').insert({ business_id: businessId, phone, direction: 'out', author: 'staff', body: text })
      // Atiende una persona: el bot no interviene en este chat por unas horas.
      await admin.from('whatsapp_chats').update({
        bot_paused_until: new Date(Date.now() + STAFF_PAUSE_HOURS * 3600_000).toISOString(),
        needs_human: false, unread: 0, last_message_at: new Date().toISOString(),
      }).eq('business_id', businessId).eq('phone', phone)
      return json({ ok: true })
    }

    if (action === 'pause' || action === 'resume' || action === 'mark_read') {
      const update = action === 'pause'
        ? { bot_paused_until: new Date(Date.now() + 7 * 24 * 3600_000).toISOString() }
        : action === 'resume'
          ? { bot_paused_until: null, needs_human: false }
          : { unread: 0 }
      await admin.from('whatsapp_chats').update(update).eq('business_id', businessId).eq('phone', phone)
      return json({ ok: true })
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[whatsapp]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

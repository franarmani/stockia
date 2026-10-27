// Avisos al dueño de CajaGo por Telegram. Lo llaman los triggers de la base (registro, pago informado,
// suscripción iniciada o activada) y un cron diario (vencimientos). Público pero con clave propia.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildAlertMessage, daysUntil, expiryAlert, suggestedWhatsAppText, whatsappLink,
  type AlertBusiness, type AlertKind,
} from '../_shared/adminAlerts.ts'

const EVENTS: AlertKind[] = ['registro', 'pago_informado', 'suscripcion_mp', 'activada']
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

Deno.serve(async request => {
  const secret = Deno.env.get('ADMIN_ALERTS_SECRET')
  if (!secret || request.headers.get('x-cajago-alerts') !== secret) return new Response('no autorizado', { status: 401 })
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!token || !chatId) return new Response('Telegram sin configurar', { status: 503 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await request.json().catch(() => ({}))
  const columns = 'id, name, phone, email, city, province, business_type, plan, subscription_status, trial_ends_at'

  async function send(kind: AlertKind, business: AlertBusiness, extra: Record<string, any> = {}, daysLeft?: number) {
    const { data: owner } = await admin.from('users').select('name, email').eq('business_id', business.id).eq('role', 'admin').order('created_at').limit(1).maybeSingle()
    const text = buildAlertMessage(kind, { business, ownerName: owner?.name, ownerEmail: owner?.email, extra, daysLeft })
    const link = whatsappLink(business.phone, suggestedWhatsAppText(kind, business.name))
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
        ...(link ? { reply_markup: { inline_keyboard: [[{ text: '💬 Escribirle por WhatsApp', url: link }]] } } : {}),
      }),
    })
    if (!response.ok) throw new Error(`Telegram ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }

  /** Registra el aviso; devuelve false si ya se había mandado (no se repite). */
  async function claim(kind: string, businessId: string, key: string) {
    const { error } = await admin.from('admin_alert_log').insert({ kind, business_id: businessId, dedupe_key: `${kind}:${businessId}:${key}` })
    return !error
  }

  try {
    if (body.daily === true) {
      const { data: businesses } = await admin.from('businesses').select(columns).in('subscription_status', ['trial', 'active', 'expired'])
      const sent: string[] = []
      for (const business of (businesses ?? []) as AlertBusiness[]) {
        const days = daysUntil(business.trial_ends_at)
        const alert = expiryAlert(days)
        if (!alert) continue
        if (!(await claim(alert.kind, business.id, `${String(business.trial_ends_at).slice(0, 10)}:${alert.step}`))) continue
        await send(alert.kind, business, {}, days ?? 0)
        sent.push(`${business.name}:${alert.kind}`)
      }
      return json({ ok: true, sent })
    }

    if (EVENTS.includes(body.event) && typeof body.business_id === 'string') {
      // El titular se crea unos segundos después del negocio: se espera para tener su nombre.
      if (body.event === 'registro') await sleep(6000)
      const { data: business } = await admin.from('businesses').select(columns).eq('id', body.business_id).maybeSingle()
      if (!business) return json({ ok: false, error: 'negocio inexistente' }, 404)
      const key = body.event === 'registro' ? 'alta' : crypto.randomUUID()
      if (!(await claim(body.event, business.id, key))) return json({ ok: true, duplicated: true })
      await send(body.event, business as AlertBusiness, body.extra ?? {})
      return json({ ok: true })
    }

    return json({ ok: false, error: 'pedido inválido' }, 400)
  } catch (error) {
    console.error('[admin-alerts]', error)
    return json({ ok: false, error: 'no se pudo enviar el aviso' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

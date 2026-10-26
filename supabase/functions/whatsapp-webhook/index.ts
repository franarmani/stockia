// Mensajes de WhatsApp que llegan desde Z-API. Público: el negocio se identifica con la clave
// secreta de la URL (?key=). El asistente responde con datos reales del catálogo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess } from '../_shared/access.ts'
import {
  BOT_LIMITS, STAFF_PAUSE_HOURS, buildSystemPrompt, isPaused, parseIncoming, searchTerms, splitHumanMarker, wantsHuman,
} from '../_shared/whatsappBot.ts'
import { hasCredentials, sendText } from '../_shared/zapi.ts'

const STORE_BASE = 'https://cajago.vercel.app/tienda/'

Deno.serve(async request => {
  // Z-API reintenta ante errores: se responde 200 salvo fallas reales del servidor.
  if (request.method !== 'POST') return new Response('ok')
  const key = new URL(request.url).searchParams.get('key') ?? ''
  if (!/^[a-f0-9]{32,64}$/.test(key)) return new Response('ignored')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const { data: connection } = await admin.from('whatsapp_connections').select('*').eq('webhook_key', key).maybeSingle()
    if (!connection) return new Response('ignored')
    const businessId = connection.business_id as string
    if (!(await businessIsActive(admin, businessId))) return new Response('ignored')

    const message = parseIncoming(await request.json().catch(() => null))
    if (!message) return new Response('ignored')

    const { data: chat } = await admin.from('whatsapp_chats').select('*').eq('business_id', businessId).eq('phone', message.phone).maybeSingle()

    // Respondió alguien del local desde el celular: el bot se calla en ese chat por un rato.
    if (message.fromMe) {
      const { error } = await admin.from('whatsapp_messages').insert({ business_id: businessId, phone: message.phone, direction: 'out', author: 'staff', body: message.text, wa_message_id: message.messageId })
      if (!error) {
        await admin.from('whatsapp_chats').upsert({
          business_id: businessId, phone: message.phone, contact_name: chat?.contact_name ?? null,
          bot_paused_until: new Date(Date.now() + STAFF_PAUSE_HOURS * 3600_000).toISOString(),
          needs_human: false, unread: 0, last_message_at: new Date().toISOString(),
        })
      }
      return new Response('ok')
    }

    const { error: insertError } = await admin.from('whatsapp_messages').insert({
      business_id: businessId, phone: message.phone, direction: 'in', author: 'customer', body: message.text, wa_message_id: message.messageId,
    })
    if (insertError) return new Response('duplicate') // ya recibido (reintento de Z-API)

    const handoff = wantsHuman(message.text)
    await admin.from('whatsapp_chats').upsert({
      business_id: businessId,
      phone: message.phone,
      contact_name: message.name ?? chat?.contact_name ?? null,
      bot_paused_until: chat?.bot_paused_until ?? null,
      needs_human: handoff || !!chat?.needs_human,
      unread: (chat?.unread ?? 0) + 1,
      last_message_at: new Date().toISOString(),
    })

    if (!connection.bot_enabled || !hasCredentials(connection) || isPaused(chat?.bot_paused_until) || chat?.needs_human) {
      return new Response('ok')
    }

    // El asistente es parte de Premium (o de la prueba) con la suscripción al día.
    const { data: business } = await admin.from('businesses')
      .select('name, address, city, phone, plan, subscription_status, trial_ends_at, store_enabled, store_slug')
      .eq('id', businessId).single()
    const premium = hasVipAccess(business)
    const current = business && business.subscription_status !== 'expired' &&
      (!business.trial_ends_at || new Date(business.trial_ends_at).getTime() > Date.now() - 3 * 86400000)
    if (!premium || !current) return new Response('ok')

    if (handoff) {
      await sendText(connection, message.phone, 'Perfecto, en breve te atiende alguien del local. 🙌')
      await admin.from('whatsapp_messages').insert({ business_id: businessId, phone: message.phone, direction: 'out', author: 'bot', body: 'Perfecto, en breve te atiende alguien del local. 🙌' })
      return new Response('ok')
    }

    // Límites para no gastar de más ante spam o conversaciones en loop.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const [{ count: chatReplies }, { count: businessReplies }] = await Promise.all([
      admin.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('phone', message.phone).eq('author', 'bot').gte('created_at', since),
      admin.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('author', 'bot').gte('created_at', since),
    ])
    if ((chatReplies ?? 0) >= BOT_LIMITS.repliesPerChatPerDay || (businessReplies ?? 0) >= BOT_LIMITS.repliesPerBusinessPerDay) {
      return new Response('ok')
    }

    const terms = searchTerms(message.text)
    let productsQuery = admin.from('products').select('name, sale_price, stock, unit').eq('business_id', businessId).eq('active', true)
    if (terms.length) productsQuery = productsQuery.or(terms.map(term => `name.ilike.%${term}%`).join(','))
    const [{ data: products }, { data: history }] = await Promise.all([
      terms.length ? productsQuery.limit(BOT_LIMITS.catalogItems) : Promise.resolve({ data: [] }),
      admin.from('whatsapp_messages').select('author, body').eq('business_id', businessId).eq('phone', message.phone)
        .order('created_at', { ascending: false }).limit(BOT_LIMITS.historyMessages),
    ])

    const system = buildSystemPrompt({
      businessName: business.name,
      address: [business.address, business.city].filter(Boolean).join(', ') || null,
      phone: business.phone,
      storeUrl: business.store_enabled && business.store_slug ? STORE_BASE + business.store_slug : null,
      instructions: connection.bot_instructions,
      products: (products ?? []) as any,
      now: new Date(),
    })

    const apiKey = Deno.env.get('VITE_GROQ_API_KEY') || Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('Falta la clave de Groq')
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          ...[...(history ?? [])].reverse().map(item => ({ role: item.author === 'customer' ? 'user' : 'assistant', content: item.body })),
        ],
      }),
    })
    const completion = await response.json().catch(() => null)
    const raw = String(completion?.choices?.[0]?.message?.content ?? '').trim()
    if (!response.ok || !raw) throw new Error(`IA sin respuesta: ${completion?.error?.message ?? response.status}`)

    const { text, handoff: modelHandoff } = splitHumanMarker(raw)
    if (text) {
      await sendText(connection, message.phone, text)
      await admin.from('whatsapp_messages').insert({ business_id: businessId, phone: message.phone, direction: 'out', author: 'bot', body: text })
    }
    if (modelHandoff) {
      await admin.from('whatsapp_chats').update({ needs_human: true }).eq('business_id', businessId).eq('phone', message.phone)
    }
    return new Response('ok')
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
    // El mensaje del cliente ya quedó guardado y visible en CajaGo; no se reintenta la respuesta.
    return new Response('error-logged')
  }
})

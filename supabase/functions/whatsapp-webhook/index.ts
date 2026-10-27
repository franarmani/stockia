// Webhook público de Z-API. El negocio se identifica con la clave secreta de la URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, hasVipAccess } from '../_shared/access.ts'
import { GROQ_CHAT_COMPLETIONS_URL, GROQ_DEFAULT_MODEL, GROQ_REQUEST_TIMEOUT_MS } from '../_shared/groq.ts'
import {
  BOT_FALLBACK_REPLY,
  BOT_LIMITS,
  STAFF_PAUSE_HOURS,
  buildSystemPrompt,
  isDuplicateMessageError,
  isPaused,
  parseIncoming,
  searchTerms,
  splitHumanMarker,
  wantsHuman,
} from '../_shared/whatsappBot.ts'
import { hasCredentials, sendText } from '../_shared/zapi.ts'

const STORE_BASE = 'https://cajago.net/tienda/'

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('ok')
  const key = new URL(request.url).searchParams.get('key') ?? ''
  if (!/^[a-f0-9]{32,64}$/.test(key)) return new Response('ignored')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const { data: connection, error: connectionError } = await admin.from('whatsapp_connections')
      .select('*')
      .eq('webhook_key', key)
      .maybeSingle()
    if (connectionError) throw new Error(connectionError.message)
    if (!connection) return new Response('ignored')

    const businessId = connection.business_id as string
    if (!(await businessIsActive(admin, businessId))) return new Response('ignored')

    const message = parseIncoming(await request.json().catch(() => null))
    if (!message) return new Response('ignored')

    const { data: chat, error: chatError } = await admin.from('whatsapp_chats')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone', message.phone)
      .maybeSingle()
    if (chatError) throw new Error(chatError.message)

    // Si responde el comercio desde el teléfono, el bot deja ese chat en manos humanas.
    if (message.fromMe) {
      const { error } = await admin.from('whatsapp_messages').insert({
        business_id: businessId,
        phone: message.phone,
        direction: 'out',
        author: 'staff',
        body: message.text,
        wa_message_id: message.messageId,
      })
      if (!error) {
        await admin.from('whatsapp_chats').upsert({
          business_id: businessId,
          phone: message.phone,
          contact_name: chat?.contact_name ?? null,
          bot_paused_until: new Date(Date.now() + STAFF_PAUSE_HOURS * 3600_000).toISOString(),
          needs_human: false,
          unread: 0,
          last_message_at: new Date().toISOString(),
        })
      }
      return new Response('ok')
    }

    const receivedAt = new Date().toISOString()
    const { data: insertedMessage, error: insertError } = await admin.from('whatsapp_messages').insert({
      business_id: businessId,
      phone: message.phone,
      direction: 'in',
      author: 'customer',
      body: message.text,
      wa_message_id: message.messageId,
    }).select('created_at').single()

    let incomingCreatedAt = insertedMessage?.created_at ?? receivedAt
    let isRetry = false
    if (insertError) {
      if (!message.messageId || !isDuplicateMessageError(insertError)) throw new Error(insertError.message)

      const { data: existingMessage, error: lookupError } = await admin.from('whatsapp_messages')
        .select('created_at')
        .eq('business_id', businessId)
        .eq('wa_message_id', message.messageId)
        .maybeSingle()
      if (lookupError || !existingMessage) {
        throw new Error(lookupError?.message ?? 'No se pudo recuperar el mensaje duplicado')
      }

      incomingCreatedAt = existingMessage.created_at
      isRetry = true
      const { count: existingReplies, error: replyLookupError } = await admin.from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('phone', message.phone)
        .eq('author', 'bot')
        .gte('created_at', incomingCreatedAt)
      if (replyLookupError) throw new Error(replyLookupError.message)
      if ((existingReplies ?? 0) > 0) return new Response('duplicate')
    }

    const handoff = wantsHuman(message.text)
    const { error: upsertChatError } = await admin.from('whatsapp_chats').upsert({
      business_id: businessId,
      phone: message.phone,
      contact_name: message.name ?? chat?.contact_name ?? null,
      bot_paused_until: chat?.bot_paused_until ?? null,
      needs_human: handoff || !!chat?.needs_human,
      unread: (chat?.unread ?? 0) + (isRetry ? 0 : 1),
      last_message_at: receivedAt,
    })
    if (upsertChatError) throw new Error(upsertChatError.message)

    if (!connection.bot_enabled || !hasCredentials(connection) || isPaused(chat?.bot_paused_until) || (chat?.needs_human && !handoff)) {
      return new Response('ok')
    }

    const { data: business, error: businessError } = await admin.from('businesses')
      .select('name, address, city, phone, plan, subscription_status, trial_ends_at, store_enabled, store_slug')
      .eq('id', businessId)
      .single()
    if (businessError) throw new Error(businessError.message)

    const premium = hasVipAccess(business)
    const current = business.subscription_status !== 'expired' &&
      (!business.trial_ends_at || new Date(business.trial_ends_at).getTime() > Date.now() - 3 * 86400000)
    if (!premium || !current) return new Response('ok')

    if (handoff) {
      const handoffReply = 'Perfecto, en breve te atiende alguien del local. 🙌'
      await sendText(connection, message.phone, handoffReply)
      await recordBotReply(admin, businessId, message.phone, handoffReply)
      return new Response('ok')
    }

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

    let text = BOT_FALLBACK_REPLY
    let modelHandoff = true
    try {
      const apiKey = Deno.env.get('GROQ_API_KEY') || Deno.env.get('VITE_GROQ_API_KEY')
      if (!apiKey) throw new Error('Falta GROQ_API_KEY')

      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(GROQ_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model: GROQ_DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 300,
          messages: [
            { role: 'system', content: system },
            ...[...(history ?? [])].reverse().map(item => ({
              role: item.author === 'customer' ? 'user' : 'assistant',
              content: item.body,
            })),
          ],
        }),
      })
      const completion = await response.json().catch(() => null)
      const raw = String(completion?.choices?.[0]?.message?.content ?? '').trim()
      if (!response.ok || !raw) throw new Error(`IA sin respuesta: ${completion?.error?.message ?? response.status}`)

      const parsed = splitHumanMarker(raw)
      text = parsed.text || BOT_FALLBACK_REPLY
      modelHandoff = parsed.handoff || !parsed.text
    } catch (error) {
      console.error('[whatsapp-webhook] groq', error)
    }

    await sendText(connection, message.phone, text)
    await recordBotReply(admin, businessId, message.phone, text)
    if (modelHandoff) {
      const { error: handoffError } = await admin.from('whatsapp_chats')
        .update({ needs_human: true })
        .eq('business_id', businessId)
        .eq('phone', message.phone)
      if (handoffError) console.error('[whatsapp-webhook] marcar derivación', handoffError)
    }
    return new Response('ok')
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
    // Z-API debe reintentar; un duplicado sin respuesta se recupera arriba.
    return new Response('retry', { status: 500 })
  }
})

async function recordBotReply(admin: any, businessId: string, phone: string, body: string) {
  const { error } = await admin.from('whatsapp_messages').insert({
    business_id: businessId,
    phone,
    direction: 'out',
    author: 'bot',
    body,
  })
  // Si WhatsApp ya recibió el mensaje, no provocamos otro envío por un fallo de auditoría.
  if (error) console.error('[whatsapp-webhook] guardar respuesta', error)
}

// Atención por WhatsApp con IA: lógica pura (se prueba con vitest).

export const ZAPI_BASE = 'https://api.z-api.io'
export const BOT_LIMITS = { repliesPerChatPerDay: 30, repliesPerBusinessPerDay: 500, historyMessages: 12, catalogItems: 15 } as const
export const HUMAN_MARKER = '[HUMANO]'
export const STAFF_PAUSE_HOURS = 12
export const BOT_FALLBACK_REPLY = '¡Hola! Recibimos tu consulta. En breve te responde una persona del local. 🙌'

export interface IncomingMessage {
  phone: string
  text: string
  name: string | null
  messageId: string | null
  fromMe: boolean
}

/** Mensaje de texto de un chat individual; grupos, canales, estados y no-texto se ignoran. */
export function parseIncoming(payload: any): IncomingMessage | null {
  if (!payload || payload.type !== 'ReceivedCallback') return null
  if (payload.isGroup || payload.isNewsletter || payload.isStatusReply || payload.broadcast) return null
  const text = String(payload.text?.message ?? '').trim()
  const phone = String(payload.phone ?? '').replace(/\D/g, '')
  if (!text || phone.length < 8) return null
  return {
    phone,
    text: text.slice(0, 2000),
    name: payload.senderName || payload.chatName || null,
    messageId: payload.messageId ? String(payload.messageId) : null,
    fromMe: payload.fromMe === true,
  }
}

const STOPWORDS = new Set(['hola', 'buenas', 'buen', 'dia', 'días', 'dias', 'tardes', 'noches', 'tenes', 'tienen', 'tenés', 'hay', 'precio', 'cuanto', 'cuánto', 'sale', 'vale', 'esta', 'está', 'para', 'por', 'con', 'una', 'uno', 'los', 'las', 'del', 'que', 'qué', 'como', 'cómo', 'quiero', 'queria', 'quería', 'necesito', 'gracias', 'favor', 'saber', 'consulta'])

/** Palabras útiles para buscar productos en el catálogo a partir del mensaje del cliente. */
export function searchTerms(text: string): string[] {
  const words = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) ?? []
  return [...new Set(words.filter((word) => !STOPWORDS.has(word)))].slice(0, 6)
}

export function wantsHuman(text: string): boolean {
  return /\b(humano|persona|encargad[oa]|due[nñ]o|reclamo|queja|hablar con alguien|atencion personal|atención personal)\b/i.test(text)
}

export function isPaused(pausedUntil: string | null | undefined, now: Date = new Date()): boolean {
  return !!pausedUntil && new Date(pausedUntil).getTime() > now.getTime()
}

export function isDuplicateMessageError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export interface BotContext {
  businessName: string
  address: string | null
  phone: string | null
  storeUrl: string | null
  instructions: string | null
  products: Array<{ name: string; sale_price: number; stock: number; unit: string | null }>
  now: Date
}

export function buildSystemPrompt(context: BotContext): string {
  const money = (value: number) => '$' + Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const catalog = context.products.length
    ? context.products.map((p) => `- ${p.name}: ${money(p.sale_price)}${p.unit && p.unit !== 'u' ? ` por ${p.unit}` : ''} (${p.stock > 0 ? 'hay stock' : 'sin stock'})`).join('\n')
    : '(no se encontraron productos relacionados con el mensaje)'
  return [
    `Sos el asistente de WhatsApp de "${context.businessName}", un comercio de Argentina. Respondés en español rioplatense (voseo), con tono amable y mensajes cortos (2 a 4 líneas, sin markdown).`,
    'Reglas:',
    '- Usá SOLO la información de abajo. Nunca inventes precios, stock, horarios, promociones ni políticas.',
    '- Si preguntan por un producto que no figura en la lista, decí que lo vas a consultar y ofrecé que lo atienda una persona.',
    '- No tomes pagos ni pidas datos de tarjetas. No confirmes pedidos: el comercio los confirma.',
    context.storeUrl ? `- Para hacer un pedido, compartí el link de la tienda online: ${context.storeUrl}` : '- Para pedidos, decí que una persona del local lo confirma por este chat.',
    `- Si el cliente pide hablar con una persona, tiene un reclamo o no podés ayudar, respondé que en breve lo atiende alguien del local y agregá al final exactamente ${HUMAN_MARKER}.`,
    '',
    `Fecha y hora actual: ${context.now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
    context.address ? `Dirección: ${context.address}` : '',
    context.phone ? `Teléfono del local: ${context.phone}` : '',
    context.instructions ? `Información que cargó el comercio (horarios, envíos, medios de pago, etc.):\n${context.instructions.slice(0, 3000)}` : '',
    '',
    'Productos relacionados con la consulta (precios actuales):',
    catalog,
  ].filter((line) => line !== '').join('\n')
}

/** Separa la respuesta del modelo del pedido de derivación a una persona. */
export function splitHumanMarker(reply: string): { text: string; handoff: boolean } {
  const handoff = reply.includes(HUMAN_MARKER)
  return { text: reply.split(HUMAN_MARKER).join('').trim(), handoff }
}

export function zapiUrl(instanceId: string, token: string, path: string): string {
  return `${ZAPI_BASE}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/${path}`
}

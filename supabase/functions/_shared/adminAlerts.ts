// Alertas para el dueño de CajaGo (Telegram): registros, intención de compra y vencimientos.
// Sin APIs de Deno: se prueba con vitest.

export type AlertKind = 'registro' | 'pago_informado' | 'suscripcion_mp' | 'activada' | 'por_vencer' | 'vencida'

export interface AlertBusiness {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  province?: string | null
  business_type?: string | null
  plan?: string | null
  subscription_status?: string | null
  trial_ends_at?: string | null
}

export interface AlertContext {
  business: AlertBusiness
  /** Titular (usuario administrador del negocio), si ya se creó. */
  ownerName?: string | null
  ownerEmail?: string | null
  extra?: Record<string, any>
  daysLeft?: number
  now?: Date
}

export const escapeHtml = (text: unknown) =>
  String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const PLAN_NAMES: Record<string, string> = { basic: 'Básico', premium: 'Premium', vip: 'VIP' }
const money = (value: unknown) => '$' + Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
const dateAr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) : '—'

/** Número listo para WhatsApp (solo dígitos, con 54 9 para celulares argentinos). Null si no alcanza. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  digits = digits.replace(/^00/, '')
  if (digits.startsWith('54')) return digits.startsWith('549') ? digits : `549${digits.slice(2)}`
  digits = digits.replace(/^0/, '')
  // "291 15 555-1234": el 15 de los celulares viejos sobra (solo si el número tiene más de 10 dígitos).
  if (digits.length > 10) digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
  return digits.length === 10 ? `549${digits}` : digits
}

export const whatsappLink = (raw: string | null | undefined, text?: string) => {
  const number = whatsappNumber(raw)
  return number ? `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null
}

/** Días de calendario (hora argentina) que faltan para una fecha; negativo si ya pasó. */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const day = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
    return Date.UTC(Number(parts.slice(0, 4)), Number(parts.slice(5, 7)) - 1, Number(parts.slice(8, 10)))
  }
  return Math.round((day(new Date(iso)) - day(now)) / 86_400_000)
}

/** Qué aviso corresponde hoy a un vencimiento (null = ninguno). Cada aviso se manda una sola vez. */
export function expiryAlert(daysLeft: number | null): { kind: 'por_vencer' | 'vencida'; step: string } | null {
  if (daysLeft === null) return null
  if (daysLeft === 3 || daysLeft === 1 || daysLeft === 0) return { kind: 'por_vencer', step: `d${daysLeft}` }
  if (daysLeft === -1) return { kind: 'vencida', step: 'd-1' }
  if (daysLeft === -3) return { kind: 'vencida', step: 'd-3' }
  return null
}

function contactLines(ctx: AlertContext): string[] {
  const { business } = ctx
  const phone = business.phone ? `+${whatsappNumber(business.phone) ?? business.phone}` : null
  const email = ctx.ownerEmail || business.email
  return [
    phone ? `📱 WhatsApp: <b>${escapeHtml(phone)}</b>` : '📱 WhatsApp: sin cargar',
    email ? `✉️ ${escapeHtml(email)}` : '',
  ].filter(Boolean)
}

function header(ctx: AlertContext): string[] {
  const { business } = ctx
  const where = [business.city, business.province].filter(Boolean).join(', ')
  return [
    `🏪 <b>${escapeHtml(business.name)}</b>${where ? ` · ${escapeHtml(where)}` : ''}`,
    ctx.ownerName ? `👤 ${escapeHtml(ctx.ownerName)}` : '',
  ].filter(Boolean)
}

export function buildAlertMessage(kind: AlertKind, ctx: AlertContext): string {
  const { business, extra = {} } = ctx
  const plan = PLAN_NAMES[String(extra.plan ?? business.plan)] ?? String(extra.plan ?? business.plan ?? '—')
  const lines: string[] = []

  switch (kind) {
    case 'registro':
      lines.push('🆕 <b>Nuevo registro</b>', ...header(ctx), ...contactLines(ctx))
      if (business.business_type) lines.push(`🧾 Rubro: ${escapeHtml(business.business_type)}`)
      lines.push(`🎁 Prueba gratis hasta el ${dateAr(business.trial_ends_at)}`)
      break
    case 'pago_informado':
      if (extra.currency === 'USDT') {
        lines.push('💳 <b>Quiere comprar: informó un pago en USDT</b>', ...header(ctx), ...contactLines(ctx),
          `📦 Plan ${escapeHtml(plan)} · ${Number(extra.amount || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} USDT${extra.network ? ` (${escapeHtml(extra.network)})` : ''}`,
          extra.tx_hash ? `🔗 TXID: <code>${escapeHtml(extra.tx_hash)}</code>` : '🔗 Sin TXID todavía',
          '👉 Verificá que llegó a tu billetera y aprobalo en el panel admin → USDT.')
        break
      }
      lines.push('💳 <b>Quiere comprar: informó un pago</b>', ...header(ctx), ...contactLines(ctx),
        `📦 Plan ${escapeHtml(plan)} · ${money(extra.amount)}`,
        '👉 Revisá el comprobante en el panel admin y aprobalo.')
      break
    case 'suscripcion_mp':
      lines.push('🛒 <b>Quiere comprar: inició la suscripción con Mercado Pago</b>', ...header(ctx), ...contactLines(ctx),
        `📦 Plan ${escapeHtml(plan)}`, 'Si termina de autorizar el débito, se activa solo.')
      break
    case 'activada':
      lines.push('✅ <b>Suscripción activada</b>', ...header(ctx), ...contactLines(ctx),
        `📦 Plan ${escapeHtml(plan)} · vence el ${dateAr(business.trial_ends_at)}`)
      break
    case 'por_vencer': {
      const days = ctx.daysLeft ?? 0
      const when = days <= 0 ? 'vence HOY' : days === 1 ? 'vence mañana' : `vence en ${days} días`
      const trial = business.subscription_status === 'trial'
      lines.push(`⏳ <b>${trial ? 'Prueba gratis' : 'Mensualidad'}: ${when}</b>`, ...header(ctx), ...contactLines(ctx),
        `📦 Plan ${escapeHtml(plan)} · ${dateAr(business.trial_ends_at)}`,
        '💬 Buen momento para escribirle.')
      break
    }
    case 'vencida':
      lines.push('⛔ <b>Mensualidad vencida: la cuenta queda bloqueada</b>', ...header(ctx), ...contactLines(ctx),
        `📦 Plan ${escapeHtml(plan)} · venció el ${dateAr(business.trial_ends_at)}`,
        '💬 Escribile para recuperarlo.')
      break
  }
  return lines.filter(Boolean).join('\n')
}

/** Mensaje de WhatsApp sugerido según el aviso (se abre desde el botón de Telegram). */
export function suggestedWhatsAppText(kind: AlertKind, businessName: string): string {
  switch (kind) {
    case 'registro': return `Hola! Soy de CajaGo. Vi que creaste la cuenta de ${businessName}. ¿Te ayudo a empezar?`
    case 'pago_informado':
    case 'suscripcion_mp': return `Hola! Soy de CajaGo. Vi que querés activar el plan de ${businessName}. ¿Te ayudo con el pago?`
    case 'activada': return `Hola! Soy de CajaGo. Tu plan de ${businessName} ya está activo. ¡Gracias!`
    case 'por_vencer': return `Hola! Soy de CajaGo. Tu plan de ${businessName} está por vencer. ¿Querés renovarlo?`
    case 'vencida': return `Hola! Soy de CajaGo. El plan de ${businessName} venció. ¿Querés reactivarlo?`
  }
}

import { format, differenceInDays, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SubscriptionDateState } from '../types/subscription.types'

const AR_TIMEZONE = 'America/Argentina/Buenos_Aires'

const CLOCK_KEY = 'cajago_clock_hw'

/** Hora que no retrocede: si atrasan el reloj de la PC, se sigue usando la última hora vista. */
export function trustedNow(): number {
  const now = Date.now()
  let seen = 0
  try { seen = Number(localStorage.getItem(CLOCK_KEY)) || 0 } catch {}
  if (now >= seen) {
    try { localStorage.setItem(CLOCK_KEY, String(now)) } catch {}
    return now
  }
  return seen
}

/** Con el negocio recién leído del servidor, el reloj local vuelve a ser confiable. */
export function resetTrustedClock() {
  try { localStorage.setItem(CLOCK_KEY, String(Date.now())) } catch {}
}

function nowInArgentina(): Date {
  const now = new Date(trustedNow())
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`)
}

function toArgentinaDate(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = formatter.formatToParts(d)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return new Date(`${y}-${m}-${day}T00:00:00-03:00`)
}

export function getSubscriptionDateState(
  endAt: string,
  startAt?: string
): SubscriptionDateState {
  const now = nowInArgentina()
  const end = toArgentinaDate(endAt)
  const start = startAt ? toArgentinaDate(startAt) : addDays(end, -30)

  const DAY_IN_MS = 1000 * 60 * 60 * 24

  const rawRemaining = Math.ceil(
    (end.getTime() - now.getTime()) / DAY_IN_MS
  )

  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / DAY_IN_MS)
  )

  const daysRemaining = Math.max(0, rawRemaining)
  const daysElapsed = Math.min(
    totalDays,
    Math.max(0, totalDays - daysRemaining)
  )

  return {
    daysRemaining,
    daysElapsed,
    totalDays,
    isExpired: now.getTime() > end.getTime(),
    expiresToday: now.getTime() === end.getTime(),
    expirationDate: end,
  }
}

export function formatSubscriptionDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd/M/yyyy')
}

export function calculateRawRemainingDays(endDate: string | null | undefined): number {
  if (!endDate) return 0
  const now = nowInArgentina()
  const end = toArgentinaDate(endDate)
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export function isSubscriptionExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return true
  const now = nowInArgentina()
  const end = toArgentinaDate(endDate)
  return end.getTime() < now.getTime()
}

export function getDaysSinceExpiration(endDate: string | null | undefined): number {
  if (!endDate) return 0
  const now = nowInArgentina()
  const end = toArgentinaDate(endDate)
  if (end.getTime() >= now.getTime()) return 0
  return Math.floor((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
}

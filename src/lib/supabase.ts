import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mrpenblsmooeqzegtcqp.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/**
 * Conexión con reintento por proxy.
 *
 * Los bloqueadores de publicidad y algunas redes cortan las llamadas a
 * supabase.co sin devolver error: la petición nunca vuelve y la app queda
 * esperando. Ir siempre por el proxy tampoco sirve —se probó y rompía por otro
 * lado—, así que se intenta primero la conexión directa con un límite corto y,
 * si no responde, se repite la petición contra /supabase-api, que Vercel
 * redirige del lado del servidor.
 *
 * El resultado queda recordado para no volver a pagar la espera en cada
 * llamada.
 */
const PROXY_PATH = '/supabase-api'
const DIRECT_TIMEOUT_MS = 6000
const PREF_KEY = 'stockia_use_proxy'

const canProxy = typeof window !== 'undefined' && !import.meta.env.DEV

let useProxy = false
try { useProxy = canProxy && localStorage.getItem(PREF_KEY) === '1' } catch {}

function toProxyUrl(url: string): string {
  return `${window.location.origin}${PROXY_PATH}${url.slice(supabaseUrl.length)}`
}

/** fetch con límite de tiempo propio, que no depende del signal del llamador. */
async function fetchWithTimeout(url: string, init: RequestInit | undefined, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchWithProxyFallback: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  // Peticiones que no van a Supabase (o en desarrollo): sin intermediarios.
  if (!canProxy || !url.startsWith(supabaseUrl)) {
    return fetch(input, init)
  }

  // El body de un RequestInit sólo puede leerse una vez, así que si hay que
  // reintentar se necesita una copia. Los métodos con cuerpo llegan siempre
  // como string desde supabase-js, pero por las dudas se resguarda.
  const body = init?.body
  const replayable = body == null || typeof body === 'string'

  if (useProxy) {
    return fetch(toProxyUrl(url), init)
  }

  try {
    const res = await fetchWithTimeout(url, init, DIRECT_TIMEOUT_MS)
    return res
  } catch (err) {
    if (!replayable) throw err

    console.warn('[Supabase] la conexión directa no responde, reintentando por proxy')
    useProxy = true
    try { localStorage.setItem(PREF_KEY, '1') } catch {}

    // Sin el signal abortado del intento anterior: con él, el reintento
    // fallaría de inmediato o quedaría colgado.
    const { signal: _discarded, ...rest } = init || {}
    return fetch(toProxyUrl(url), rest)
  }
}

/**
 * Sin el lock del navegador.
 *
 * supabase-js sincroniza la sesion entre pestañas con Navigator LockManager.
 * Si ese candado queda tomado —una pestaña que no cerro bien, la PWA en
 * segundo plano— toda operacion de auth espera 10 segundos y falla con
 * "Acquiring an exclusive Navigator LockManager lock timed out", dejando el
 * login colgado en "Ingresando...".
 *
 * Pasamos un lock que ejecuta la operacion directamente. Se pierde la
 * coordinacion entre pestañas al refrescar el token, que en la practica es
 * inofensivo, y a cambio la sesion nunca se traba.
 */
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithProxyFallback },
})

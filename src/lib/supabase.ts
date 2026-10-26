import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mrpenblsmooeqzegtcqp.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

import { checkIsTauriDesktop } from '@/sync/storage'

/**
 * Conexión con reintento por proxy.
 *
 * Los bloqueadores de publicidad y algunas redes cortan las llamadas a
 * supabase.co sin devolver error en navegadores web. Ir por /supabase-api
 * solo es válido en la Web alojada en Vercel (donde existe la regla de rewrite).
 *
 * En la aplicación Desktop (Tauri/CajaGo.exe), el origen es local (tauri.localhost)
 * y NO existe /supabase-api; si se intentara redirigir allí devolvería index.html
 * provocando el error: "Unexpected token '<', '<!DOCTYPE ...'".
 * Por lo tanto, en Desktop se conecta SIEMPRE de forma directa.
 */
const PROXY_PATH = '/supabase-api'
const DIRECT_TIMEOUT_MS = 12000
const DESKTOP_TIMEOUT_MS = 20000
const PREF_KEY = 'stockia_use_proxy'

function determineCanProxy(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return false

  // Si estamos en la app de escritorio o en un origen local, NUNCA usar proxy
  if (checkIsTauriDesktop()) return false

  const host = window.location.hostname || ''
  return host.includes('vercel.app') || host.includes('cajago.com') || host.includes('stockia')
}

const canProxy = determineCanProxy()

let useProxy = false
try {
  if (!canProxy) {
    // Si quedó un valor previo guardado en una sesión de escritorio, limpiarlo de inmediato
    localStorage.removeItem(PREF_KEY)
    useProxy = false
  } else {
    useProxy = localStorage.getItem(PREF_KEY) === '1'
  }
} catch {}

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

  // En la aplicación de escritorio o peticiones que no van a Supabase: conexión directa nativa.
  if (!url.startsWith(supabaseUrl)) return fetch(input, init)
  if (!canProxy) {
    // Sin límite, una conexión trabada (p. ej. al volver de suspensión) deja la pantalla cargando para siempre.
    if (url.includes('/storage/v1/')) return fetch(input, init)
    return fetchWithTimeout(url, init, DESKTOP_TIMEOUT_MS)
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
 * Comprueba que Supabase responda de verdad (no alcanza con navigator.onLine:
 * puede haber red sin Internet, o Internet con Supabase caído).
 */
export async function pingSupabase(timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      canProxy && useProxy ? toProxyUrl(`${supabaseUrl}/auth/v1/health`) : `${supabaseUrl}/auth/v1/health`,
      { headers: { apikey: supabaseAnonKey }, cache: 'no-store' },
      timeoutMs
    )
    // Cualquier respuesta HTTP (incluso 401) prueba que el servidor está vivo; 5xx no.
    return res.status < 500
  } catch {
    return false
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

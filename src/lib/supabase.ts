import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mrpenblsmooeqzegtcqp.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/**
 * Conexión con reintento por proxy.
 *
 * Los bloqueadores de publicidad y algunas redes cortan las llamadas a
 * supabase.co sin devolver error: la petición simplemente nunca vuelve y el
 * login queda colgado hasta que vence el timeout.
 *
 * Ir siempre por el proxy tampoco sirve —se probó y rompía por otro lado—, así
 * que este fetch intenta primero la conexión directa y, si se cuelga o falla,
 * repite la misma petición contra /supabase-api, que Vercel redirige del lado
 * del servidor. Una vez que el proxy funciona queda fijado para el resto de la
 * sesión y no se vuelve a pagar la espera.
 */
const PROXY_PATH = '/supabase-api'
const DIRECT_TIMEOUT_MS = 6000
const PREF_KEY = 'stockia_use_proxy'

function proxyAvailable(): boolean {
  return typeof window !== 'undefined' && !import.meta.env.DEV
}

function readProxyPref(): boolean {
  try { return localStorage.getItem(PREF_KEY) === '1' } catch { return false }
}

let useProxy = proxyAvailable() && readProxyPref()

function toProxyUrl(url: string): string {
  if (!url.startsWith(supabaseUrl)) return url
  return `${window.location.origin}${PROXY_PATH}${url.slice(supabaseUrl.length)}`
}

const fetchWithProxyFallback: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  // Ya sabemos que la conexión directa no pasa: vamos derecho al proxy.
  if (useProxy && proxyAvailable()) {
    return fetch(toProxyUrl(url), init)
  }

  if (!proxyAvailable() || !url.startsWith(supabaseUrl)) {
    return fetch(input, init)
  }

  // El AbortController propio no debe pisar el del llamador.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  init?.signal?.addEventListener('abort', onCallerAbort)

  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return res
  } catch (err) {
    // Si abortó el llamador, no es un problema de red: no reintentamos.
    if (init?.signal?.aborted) throw err

    console.warn('[Supabase] conexión directa bloqueada, reintentando por proxy')
    useProxy = true
    try { localStorage.setItem(PREF_KEY, '1') } catch {}
    return fetch(toProxyUrl(url), init)
  } finally {
    clearTimeout(timer)
    init?.signal?.removeEventListener('abort', onCallerAbort)
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithProxyFallback },
})

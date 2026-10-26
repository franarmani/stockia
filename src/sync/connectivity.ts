/**
 * CajaGo — Conectividad real
 * "Online" significa que hay red Y que Supabase responde. Si Supabase está caído,
 * la app se comporta igual que sin Internet: todo se guarda local y se sincroniza después.
 */

import { pingSupabase } from '@/lib/supabase'

type ConnectivityListener = (online: boolean) => void

const PING_INTERVAL_ONLINE_MS = 60_000
const PING_INTERVAL_OFFLINE_MS = 15_000

let backendReachable = true
let lastEmitted = true
let started = false
let timer: ReturnType<typeof setTimeout> | null = null
let checking: Promise<boolean> | null = null
const listeners = new Set<ConnectivityListener>()

function networkUp(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function isOnline(): boolean {
  return networkUp() && backendReachable
}

function emitIfChanged() {
  const now = isOnline()
  if (now === lastEmitted) return
  lastEmitted = now
  listeners.forEach((fn) => fn(now))
}

function setReachable(value: boolean) {
  backendReachable = value
  emitIfChanged()
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { checkConnectivity() }, isOnline() ? PING_INTERVAL_ONLINE_MS : PING_INTERVAL_OFFLINE_MS)
}

/** Fuerza una verificación contra Supabase. Llamadas simultáneas comparten el mismo ping. */
export function checkConnectivity(): Promise<boolean> {
  if (!networkUp()) {
    setReachable(false)
    schedule()
    return Promise.resolve(false)
  }
  if (!checking) {
    checking = pingSupabase()
      .then((ok) => {
        setReachable(ok)
        return isOnline()
      })
      .finally(() => {
        checking = null
        schedule()
      })
  }
  return checking
}

/** Un request falló por red: marcamos offline sin esperar al próximo ping. */
export function reportNetworkFailure() {
  setReachable(false)
  schedule()
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false
  const message = String((error as any)?.message ?? error).toLowerCase()
  return (
    (error as any)?.name === 'AbortError' ||
    (error as any)?.name === 'AuthRetryableFetchError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('aborted')
  )
}

/** Texto de confirmación que aclara cuando el cambio quedó solo en este equipo por ahora. */
export function withSyncNote(message: string): string {
  return isOnline() ? message : `${message} · se sincronizará al volver la conexión`
}

export function onConnectivityChange(listener: ConnectivityListener): () => void {
  startConnectivityMonitor()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function startConnectivityMonitor() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => { checkConnectivity() })
  window.addEventListener('offline', () => {
    emitIfChanged()
    schedule()
  })
  checkConnectivity()
}

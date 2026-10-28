/**
 * CajaGo — Acceso local-first con actualización en segundo plano
 * - cachedRead: si el dato ya está guardado en este equipo, lo devuelve al instante (0ms)
 *   y actualiza desde Supabase en segundo plano; si cambió, avisa a las pantallas abiertas.
 *   Si es la primera vez (o hubo una escritura reciente), consulta Supabase y lo guarda.
 * - callRpcOrQueue: con conexión ejecuta la función del servidor al instante (con sus
 *   validaciones); sin conexión la deja en la cola para enviarla después.
 */

import { supabase } from '@/lib/supabase'
import { syncEngine } from './syncEngine'
import { getLocalConfig, setLocalConfig } from './storage'
import { isNetworkError, isOnline, reportNetworkFailure } from './connectivity'
import { fingerprint, hadRecentRemoteWrite, markRemoteWrite } from './freshness'
import type { RpcOperationPayload } from './types'

export class OfflineDataUnavailableError extends Error {
  constructor() {
    super('Sin conexión: estos datos todavía no se guardaron en este equipo. Se cargarán al volver la conexión.')
  }
}

const REVALIDATE_THROTTLE_MS = 20_000
const inFlightReads = new Map<string, Promise<unknown>>()
const lastRevalidatedAt = new Map<string, number>()

async function revalidateInBackground<T>(key: string, cacheKey: string, cachedJson: string, fetchRemote: () => Promise<T>): Promise<void> {
  if (inFlightReads.has(key)) return
  const last = lastRevalidatedAt.get(key) || 0
  if (Date.now() - last < REVALIDATE_THROTTLE_MS) return

  const promise = (async () => {
    try {
      const fresh = await fetchRemote()
      const freshJson = JSON.stringify(fresh)
      lastRevalidatedAt.set(key, Date.now())
      if (fingerprint(freshJson) !== fingerprint(cachedJson)) {
        await setLocalConfig(cacheKey, freshJson)
        syncEngine.notifyDataUpdated()
      }
    } catch (error) {
      if (isNetworkError(error)) reportNetworkFailure()
    } finally {
      inFlightReads.delete(key)
    }
  })()

  inFlightReads.set(key, promise)
}

export async function cachedRead<T>(key: string, fetchRemote: () => Promise<T>): Promise<T> {
  await syncEngine.init()
  const cacheKey = `read_cache:${key}`
  const cached = await getLocalConfig(cacheKey)

  if (!isOnline()) {
    if (cached !== null) return JSON.parse(cached) as T
    throw new OfflineDataUnavailableError()
  }

  // Si ya tenemos el dato en la PC y no hubo una escritura recién hecha, devolvemos
  // al instante desde la base local y refrescamos en segundo plano sin trabar la pantalla.
  if (cached !== null && !hadRecentRemoteWrite()) {
    void revalidateInBackground(key, cacheKey, cached, fetchRemote)
    return JSON.parse(cached) as T
  }

  try {
    const data = await fetchRemote()
    const serialized = JSON.stringify(data)
    lastRevalidatedAt.set(key, Date.now())
    await setLocalConfig(cacheKey, serialized)
    return data
  } catch (error) {
    if (!isNetworkError(error)) throw error
    reportNetworkFailure()
  }

  if (cached !== null) return JSON.parse(cached) as T
  throw new OfflineDataUnavailableError()
}

type QueryResult<T> = { data: T | null; error: any; count?: number | null }

/**
 * Igual que cachedRead pero para una consulta de Supabase ya armada (se ejecuta recién al
 * esperarla, así que sin conexión o con caché local fresca no bloquea la interfaz).
 */
export async function cachedQuery<T>(key: string, query: PromiseLike<QueryResult<T>>): Promise<QueryResult<T>> {
  try {
    const { data, count } = await cachedRead(key, async () => {
      const result = await query
      if (result.error) throw result.error
      return { data: result.data, count: result.count ?? null }
    })
    return { data, count, error: null }
  } catch (error) {
    return { data: null, count: null, error }
  }
}

/** Fecha local YYYY-MM-DD para claves de caché de datos "de hoy". */
export function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Devuelve el resultado de la función, o null si quedó en la cola para enviarse después. */
export async function callRpcOrQueue<T = unknown>(payload: Omit<RpcOperationPayload, 'attempted_at'>): Promise<T | null> {
  await syncEngine.init()
  markRemoteWrite()

  if (isOnline()) {
    const { data, error } = await (supabase as any).rpc(payload.rpc, payload.args)
      .then((result: any) => result, (thrown: unknown) => ({ data: null, error: thrown }))
    if (!error) return data as T
    if (!isNetworkError(error)) throw error
    reportNetworkFailure()
    // El pedido pudo haber llegado: al reintentar se verifica antes de repetirlo.
    await syncEngine.queueRpc({ ...payload, attempted_at: new Date().toISOString() })
    return null
  }

  await syncEngine.queueRpc({ ...payload, attempted_at: null })
  return null
}

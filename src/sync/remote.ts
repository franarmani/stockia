/**
 * CajaGo — Acceso al servidor con respaldo local
 * - cachedRead: con conexión consulta Supabase y guarda la respuesta en la base local;
 *   sin conexión devuelve lo último guardado en este equipo.
 * - callRpcOrQueue: con conexión ejecuta la función del servidor al instante (con sus
 *   validaciones); sin conexión la deja en la cola para enviarla después.
 */

import { supabase } from '@/lib/supabase'
import { syncEngine } from './syncEngine'
import { getLocalConfig, setLocalConfig } from './storage'
import { isNetworkError, isOnline, reportNetworkFailure } from './connectivity'
import type { RpcOperationPayload } from './types'

export class OfflineDataUnavailableError extends Error {
  constructor() {
    super('Sin conexión: estos datos todavía no se guardaron en este equipo. Se cargarán al volver la conexión.')
  }
}

export async function cachedRead<T>(key: string, fetchRemote: () => Promise<T>): Promise<T> {
  await syncEngine.init()
  const cacheKey = `read_cache:${key}`

  if (isOnline()) {
    try {
      const data = await fetchRemote()
      await setLocalConfig(cacheKey, JSON.stringify(data))
      return data
    } catch (error) {
      if (!isNetworkError(error)) throw error
      reportNetworkFailure()
    }
  }

  const cached = await getLocalConfig(cacheKey)
  if (cached !== null) return JSON.parse(cached) as T
  throw new OfflineDataUnavailableError()
}

type QueryResult<T> = { data: T | null; error: any; count?: number | null }

/**
 * Igual que cachedRead pero para una consulta de Supabase ya armada (se ejecuta recién al
 * esperarla, así que sin conexión ni se envía). Devuelve el mismo { data, error, count }.
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

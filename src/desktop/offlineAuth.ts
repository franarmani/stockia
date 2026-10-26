/**
 * CajaGo — Ingreso sin conexión
 * El primer ingreso en un equipo necesita Internet. Ahí se guarda en la base local un hash
 * PBKDF2 (SHA-256, con sal) de la contraseña, nunca la contraseña. Sin conexión, solo un
 * usuario que ya ingresó en este equipo y escribe la misma contraseña puede volver a entrar.
 */

import { syncEngine } from '@/sync/syncEngine'
import { getLocalConfig, setLocalConfig } from '@/sync/storage'

const ITERATIONS = 210_000

interface OfflineCredential {
  user_id: string
  salt: string
  hash: string
  iterations: number
}

export interface OfflineSnapshot {
  user: Record<string, any>
  profile: Record<string, any>
  business: Record<string, any> | null
}

const credentialKey = (email: string) => `offline_credential:${email.trim().toLowerCase()}`
const snapshotKey = (userId: string) => `offline_snapshot:${userId}`

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

export async function derivePasswordHash(password: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toBase64(new Uint8Array(bits))
}

export async function rememberOfflineCredential(email: string, password: string, userId: string): Promise<void> {
  await syncEngine.init()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const credential: OfflineCredential = {
    user_id: userId,
    salt: toBase64(salt),
    hash: await derivePasswordHash(password, salt),
    iterations: ITERATIONS,
  }
  await setLocalConfig(credentialKey(email), JSON.stringify(credential))
}

/** Devuelve el id del usuario si la contraseña coincide con la del último ingreso online. */
export async function verifyOfflineCredential(email: string, password: string): Promise<string | null> {
  await syncEngine.init()
  const stored = await getLocalConfig(credentialKey(email))
  if (!stored) return null
  const credential = JSON.parse(stored) as OfflineCredential
  const hash = await derivePasswordHash(password, fromBase64(credential.salt), credential.iterations)
  return hash === credential.hash ? credential.user_id : null
}

export async function saveOfflineSnapshot(userId: string, snapshot: OfflineSnapshot): Promise<void> {
  await syncEngine.init()
  await setLocalConfig(snapshotKey(userId), JSON.stringify(snapshot))
}

export async function getOfflineSnapshot(userId: string): Promise<OfflineSnapshot | null> {
  await syncEngine.init()
  const stored = await getLocalConfig(snapshotKey(userId))
  return stored ? JSON.parse(stored) : null
}

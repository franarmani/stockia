/**
 * CajaGo — Workstation / Device Identity Manager
 * Provides unique device_id (UUID) and friendly terminal name (e.g. "Caja Principal").
 */

import { checkIsTauriDesktop, getLocalConfig, setLocalConfig } from '../sync/storage'

const DEVICE_ID_KEY = 'cajago_device_id'
const DEVICE_NAME_KEY = 'cajago_device_name'

export async function getDeviceId(): Promise<string> {
  // Check storage first
  const existing = await getLocalConfig(DEVICE_ID_KEY)
  if (existing) return existing

  // Check localStorage fallback
  const localVal = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null
  if (localVal) {
    await setLocalConfig(DEVICE_ID_KEY, localVal)
    return localVal
  }

  // Generate new UUID for this workstation
  const newId = crypto.randomUUID()
  await setLocalConfig(DEVICE_ID_KEY, newId)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEVICE_ID_KEY, newId)
  }
  return newId
}

export async function getDeviceName(): Promise<string> {
  const existing = await getLocalConfig(DEVICE_NAME_KEY)
  if (existing) return existing

  const localVal = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_NAME_KEY) : null
  if (localVal) return localVal

  // Default friendly workstation name
  const defaultName = checkIsTauriDesktop() ? 'Caja Desktop Windows' : 'Terminal Web / PWA'
  await setLocalConfig(DEVICE_NAME_KEY, defaultName)
  return defaultName
}

export async function setDeviceName(name: string): Promise<void> {
  await setLocalConfig(DEVICE_NAME_KEY, name)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEVICE_NAME_KEY, name)
  }
}

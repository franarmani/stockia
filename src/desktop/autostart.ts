/**
 * CajaGo — Autostart Manager (Windows Startup)
 * Integrates with @tauri-apps/plugin-autostart.
 * OFF by default, user-configurable from Settings.
 */

import { checkIsTauriDesktop } from '../sync/storage'

export async function isAutostartEnabled(): Promise<boolean> {
  if (!checkIsTauriDesktop()) return false

  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart')
    return await isEnabled()
  } catch (err) {
    console.warn('[CajaGo Autostart] Check error:', err)
    return false
  }
}

export async function enableAutostart(): Promise<void> {
  if (!checkIsTauriDesktop()) return

  try {
    const { enable } = await import('@tauri-apps/plugin-autostart')
    await enable()
  } catch (err) {
    console.error('[CajaGo Autostart] Enable error:', err)
  }
}

export async function disableAutostart(): Promise<void> {
  if (!checkIsTauriDesktop()) return

  try {
    const { disable } = await import('@tauri-apps/plugin-autostart')
    await disable()
  } catch (err) {
    console.error('[CajaGo Autostart] Disable error:', err)
  }
}

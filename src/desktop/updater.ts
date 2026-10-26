/**
 * CajaGo — Desktop Automatic Updater
 * Integrates with @tauri-apps/plugin-updater.
 * Supports signature verification, background checking, and minimum_supported_version enforcement.
 */

import { checkIsTauriDesktop } from '../sync/storage'

export interface UpdateInfo {
  available: boolean
  currentVersion: string
  version?: string
  date?: string
  body?: string
  isMandatory?: boolean
}

let startupTimeout: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let checkInProgress = false

/**
 * Compare two semver strings: returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

/**
 * Check for updates using Tauri updater plugin.
 */
export async function checkForAppUpdates(): Promise<UpdateInfo | null> {
  if (!checkIsTauriDesktop()) {
    return null
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const { getVersion } = await import('@tauri-apps/api/app')

    const currentVersion = await getVersion()
    const update = await check()

    if (!update) {
      return {
        available: false,
        currentVersion,
      }
    }

    // Check if body or release notes specify minimum_supported_version
    let isMandatory = false
    const minVerMatch = update.body?.match(/minimum_version:\s*([0-9.]+)/i)
    if (minVerMatch && minVerMatch[1]) {
      const minVersion = minVerMatch[1]
      if (compareSemver(minVersion, currentVersion) > 0) {
        isMandatory = true
      }
    }

    return {
      available: true,
      currentVersion,
      version: update.version,
      date: update.date,
      body: update.body,
      isMandatory,
    }
  } catch (err) {
    console.warn('[CajaGo Updater] Error checking for updates:', err)
    return null
  }
}

/**
 * Download, verify signature, install, and relaunch.
 */
export async function installAppUpdate(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!checkIsTauriDesktop()) return

  const { check } = await import('@tauri-apps/plugin-updater')
  const { relaunch } = await import('@tauri-apps/plugin-process')

  const update = await check()
  if (!update) return

  let downloaded = 0
  let contentLength = 0

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength || 0
        break
      case 'Progress':
        downloaded += event.data.chunkLength
        if (contentLength > 0 && onProgress) {
          onProgress(Math.round((downloaded / contentLength) * 100))
        }
        break
      case 'Finished':
        if (onProgress) onProgress(100)
        break
    }
  })

  // Restart application into new version
  await relaunch()
}

/**
 * Initialize periodic updater check (upon launch and then every 4 hours).
 */
export function initPeriodicUpdater(onUpdateAvailable: (info: UpdateInfo) => void) {
  if (!checkIsTauriDesktop()) return () => {}

  const runCheck = async () => {
    if (checkInProgress) return
    checkInProgress = true
    try {
      const info = await checkForAppUpdates()
      if (info?.available) onUpdateAvailable(info)
    } finally {
      checkInProgress = false
    }
  }

  if (startupTimeout) clearTimeout(startupTimeout)
  if (checkInterval) clearInterval(checkInterval)

  // Check 5 seconds after startup
  startupTimeout = setTimeout(runCheck, 5000)

  // Check every 4 hours (avoid aggressive polling)
  checkInterval = setInterval(runCheck, 4 * 60 * 60 * 1000)

  return () => {
    if (startupTimeout) clearTimeout(startupTimeout)
    if (checkInterval) clearInterval(checkInterval)
    startupTimeout = null
    checkInterval = null
  }
}

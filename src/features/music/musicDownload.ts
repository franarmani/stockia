import { checkIsTauriDesktop } from '@/sync/storage'
import { PUBLIC_WEB_URL } from '@/config/publicUrls'

// El instalador no trae las canciones de CajaGo Music: se descargan una vez desde la web
// y quedan guardadas en la caché del programa para sonar sin internet.

const CACHE_NAME = 'cajago-music-v1'
const DOWNLOADED_KEY = 'cajago_music_downloaded'
const PROMPT_SNOOZE_KEY = 'cajago_music_prompt_until'
export const MUSIC_DOWNLOAD_MB = 75

async function musicFiles(): Promise<string[]> {
  // Import dinámico: la página de música importa el reproductor, que importa este archivo.
  const { INITIAL_TRACKS } = await import('@/pages/music/MusicPage')
  return ['fixed-techno', 'fixed-rock'].flatMap(id => INITIAL_TRACKS(id).map(track => track.file_url))
}

export function isMusicDownloaded(): boolean {
  try { return localStorage.getItem(DOWNLOADED_KEY) === '1' } catch { return false }
}

/** Se pregunta al abrir el programa, salvo que ya esté descargada o hayan dicho "Ahora no" hace poco. */
export function shouldOfferMusicDownload(): boolean {
  if (!checkIsTauriDesktop() || isMusicDownloaded() || typeof caches === 'undefined') return false
  try { return Date.now() > Number(localStorage.getItem(PROMPT_SNOOZE_KEY) || 0) } catch { return true }
}

export function snoozeMusicDownload(days = 7) {
  try { localStorage.setItem(PROMPT_SNOOZE_KEY, String(Date.now() + days * 86400000)) } catch {}
}

export async function downloadMusic(onProgress: (done: number, total: number) => void): Promise<void> {
  const files = await musicFiles()
  const cache = await caches.open(CACHE_NAME)
  let done = 0
  for (const path of files) {
    if (!(await cache.match(path))) {
      const response = await fetch(PUBLIC_WEB_URL + path)
      if (!response.ok) throw new Error(`No se pudo descargar ${path} (${response.status})`)
      await cache.put(path, response)
    }
    onProgress(++done, files.length)
  }
  try { localStorage.setItem(DOWNLOADED_KEY, '1') } catch {}
}

let lastObjectUrl: string | null = null

/** En el escritorio: la canción guardada si está; si no, desde la web. */
export async function resolveTrackUrl(url: string): Promise<string> {
  if (!checkIsTauriDesktop() || !url.startsWith('/music/')) return url
  try {
    const cached = await (await caches.open(CACHE_NAME)).match(url)
    if (cached) {
      if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl)
      lastObjectUrl = URL.createObjectURL(await cached.blob())
      return lastObjectUrl
    }
  } catch {}
  return PUBLIC_WEB_URL + url
}

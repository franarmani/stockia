import { checkIsTauriDesktop } from '../sync/storage'

/** Abre un link en el navegador del sistema (en Desktop, fuera de la ventana de CajaGo). */
export async function openExternal(url: string): Promise<void> {
  if (checkIsTauriDesktop()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return
    } catch (error) {
      console.warn('[openExternal] opener no disponible, se usa window.open:', error)
    }
  }
  window.open(url, '_blank', 'noopener')
}

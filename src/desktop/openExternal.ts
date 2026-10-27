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

/**
 * En el programa, window.open con un link (WhatsApp, Mercado Pago, soporte) no abre nada.
 * Se redirige al navegador del sistema; las ventanas de impresión (sin URL) siguen igual.
 */
export function installExternalLinkHandler() {
  if (!checkIsTauriDesktop()) return
  const original = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url ? String(url) : ''
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      openExternal(href)
      return null
    }
    return original(url, target, features)
  }) as typeof window.open
}

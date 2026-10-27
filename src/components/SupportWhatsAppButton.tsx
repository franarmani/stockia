import { useLocation } from 'react-router-dom'
import { checkIsTauriDesktop } from '@/sync/storage'
import { SUPPORT_WHATSAPP_URL } from '@/config/publicUrls'

// Solo en las páginas públicas de CajaGo: dentro de la aplicación tapa botones y el escáner,
// y en las tiendas de los comercios no corresponde.
const PUBLIC_PATHS = ['/', '/login', '/register', '/descargar', '/terminos', '/privacidad', '/landing']

/** Botón flotante de WhatsApp para que los visitantes de la web hablen con CajaGo. */
export default function SupportWhatsAppButton() {
  const { pathname } = useLocation()
  if (checkIsTauriDesktop() || !PUBLIC_PATHS.includes(pathname)) return null

  const href = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent('Hola! Quiero consultar por CajaGo.')}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg shadow-black/30 transition hover:brightness-105 sm:pr-5"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M16.04 3C9.1 3 3.46 8.63 3.46 15.57c0 2.22.58 4.38 1.68 6.29L3.36 28.5l6.8-1.78a12.53 12.53 0 0 0 5.88 1.49h.01c6.93 0 12.57-5.64 12.57-12.57 0-3.36-1.31-6.52-3.68-8.89A12.49 12.49 0 0 0 16.04 3Zm0 22.98h-.01a10.4 10.4 0 0 1-5.31-1.46l-.38-.23-4.04 1.06 1.08-3.94-.25-.4a10.38 10.38 0 0 1-1.6-5.54c0-5.75 4.68-10.43 10.44-10.43 2.78 0 5.4 1.09 7.37 3.06a10.36 10.36 0 0 1 3.05 7.38c0 5.75-4.68 10.43-10.43 10.43Zm5.72-7.81c-.31-.16-1.85-.91-2.14-1.02-.29-.1-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.18.21-.37.23-.68.08-.31-.16-1.32-.49-2.52-1.56-.93-.83-1.56-1.86-1.74-2.17-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.62s1.13 3.04 1.28 3.25c.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.75.24 1.44.21 1.98.13.6-.09 1.85-.76 2.11-1.49.26-.73.26-1.36.18-1.49-.08-.13-.29-.21-.6-.37Z" />
      </svg>
      <span className="hidden text-sm font-semibold sm:inline">¿Consultas? Escribinos</span>
    </a>
  )
}

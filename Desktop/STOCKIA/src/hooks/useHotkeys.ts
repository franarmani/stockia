import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Global hotkeys for STOCKIA launcher:
 *   ESC  → /menu  (only if no dialog/modal is open)
 *   F2   → /pos
 *
 *   Letter shortcuts (single key, no modifier, not while typing):
 *   I  → /dashboard   (Inicio)
 *   V  → /pos         (Venta)
 *   P  → /products    (Productos)
 *   C  → /purchases   (Compras)
 *   L  → /customers   (cLientes)
 *   F  → /comprobantes(Facturas)
 *   J  → /cash-register (caJa)
 *   H  → /sales       (Historial)
 *   R  → /reports     (Reportes)
 *   S  → /settings    (Settings)
 */
export function useHotkeys() {
  const navigate = useNavigate()

  useEffect(() => {
    const LETTER_ROUTES: Record<string, string> = {
      i: '/dashboard',
      v: '/pos',
      p: '/products',
      c: '/purchases',
      l: '/customers',
      f: '/comprobantes',
      j: '/cash-register',
      h: '/sales',
      r: '/reports',
      s: '/settings',
    }

    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is on an input / textarea / select / contenteditable
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const isEditing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        target?.isContentEditable

      // Ignore if a modifier key is held (Ctrl/Alt/Meta shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Check if any modal/dialog is currently open in the DOM
      const hasOpenDialog =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-modal-open="true"]') !== null

      if (e.key === 'Escape' && !isEditing && !hasOpenDialog) {
        e.preventDefault()
        navigate('/menu')
      }

      if (e.key === 'F2' && !isEditing) {
        e.preventDefault()
        navigate('/pos')
      }

      if (e.key === 'F11') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      }

      // Single-letter navigation (no modifier, not editing, no open modal)
      if (!isEditing && !hasOpenDialog && e.key.length === 1 && !e.shiftKey) {
        const route = LETTER_ROUTES[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          navigate(route)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}

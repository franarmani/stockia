import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Global hotkeys for CajaGo:
 *   F1 / F2 → Abrir Punto de Venta (POS)
 *   F11     → Alternar pantalla completa
 *   Escape  → Volver al Inicio (/menu)
 *
 *   Atajos por letra (cuando no se está escribiendo en un campo de texto):
 *   I → /menu          (Inicio)
 *   V → /pos           (Venta / POS)
 *   P → /products      (Productos / Inventario)
 *   C → /cash-register (Control de Caja)
 *   L → /customers     (Clientes)
 *   F → /comprobantes  (Comprobantes AFIP)
 *   H → /sales         (Historial de Ventas)
 *   R → /reports       (Reportes)
 *   S → /settings      (Configuración)
 *   G → /purchases     (Gastos y Compras)
 */
export function useHotkeys() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const LETTER_ROUTES: Record<string, string> = {
      i: '/menu',
      v: '/pos',
      p: '/products',
      c: '/cash-register',
      l: '/customers',
      f: '/comprobantes',
      h: '/sales',
      r: '/reports',
      s: '/settings',
      g: '/purchases',
    }

    const handler = (e: KeyboardEvent) => {
      const isPOS = location.pathname === '/pos'

      // ── Teclas de función globales (SIEMPRE operativas sin importar el foco) ──
      if (e.key === 'F1' || e.key === 'F2') {
        e.preventDefault()
        if (!isPOS) {
          navigate('/pos')
        }
        return
      }

      if (e.key === 'F11') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
        return
      }

      // Si estamos en POS, dejamos que POSPage gestione Escape y demás teclas operativas
      if (isPOS) return

      // Detección de elementos de entrada donde el usuario escribe
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const isEditing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        target?.isContentEditable

      // Detección de modales activos
      const hasOpenDialog =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-modal-open="true"]') !== null

      // Escape global (fuera de POS): si no hay modal abierto y no estamos en /menu, volver al inicio
      if (e.key === 'Escape' && !hasOpenDialog && location.pathname !== '/menu') {
        e.preventDefault()
        navigate('/menu')
        return
      }

      // Navegación por letras: no ejecutar si se está escribiendo, si hay modificadores o si hay un modal
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditing || hasOpenDialog) return

      if (e.key.length === 1 && !e.shiftKey) {
        const route = LETTER_ROUTES[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          navigate(route)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location.pathname])
}

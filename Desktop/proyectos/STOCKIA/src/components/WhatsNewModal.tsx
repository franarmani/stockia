import { useState, useEffect } from 'react'
import { X, Sparkles, Brain, Package, BarChart3, RefreshCw, MessageCircle, Bell, ShoppingCart, Rocket } from 'lucide-react'

const WHATS_NEW_VERSION = '2.5'
const STORAGE_KEY = 'stockia_whats_new_seen'

interface ChangeItem {
  icon: React.ReactNode
  title: string
  description: string
  tag?: string
}

const changes: ChangeItem[] = [
  {
    icon: <Brain className="w-5 h-5" />,
    title: 'Categorización IA automática',
    description:
      'Al crear o editar un producto, el sistema sugiere categorías inteligentes basándose en el nombre. Se auto-aplica si la confianza es ≥ 90 %.',
    tag: 'Nuevo',
  },
  {
    icon: <Package className="w-5 h-5" />,
    title: 'Categorías IA masivas',
    description:
      'Nuevo botón "Categorías IA" en Productos: asigná categorías a todos tus productos de una sola vez con sugerencias inteligentes, sección manual y aprendizaje continuo.',
    tag: 'Nuevo',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Ventas anuladas excluidas',
    description:
      'Las ventas anuladas ya no se suman en los totales del Dashboard, Reportes ni Historial de Ventas. Datos más precisos.',
    tag: 'Mejora',
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    title: 'Datos en tiempo real',
    description:
      'Dashboard, Ventas y Reportes ahora se actualizan al instante cuando se registra una venta desde otro dispositivo o pestaña.',
    tag: 'Mejora',
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'WhatsApp Quick Chat Pro',
    description:
      'Nuevo módulo premium: contactá a tus clientes por WhatsApp directo desde Stockia con mensajes rápidos, plantillas y seguimiento de conversaciones.',
    tag: 'Pro',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: 'Notificaciones mejoradas',
    description:
      'Panel de notificaciones rediseñado con mejor visibilidad y contraste para que no te pierdas ninguna alerta.',
    tag: 'Mejora',
  },
  {
    icon: <ShoppingCart className="w-5 h-5" />,
    title: 'Mejoras en Punto de Venta',
    description:
      'Nuevo banner de tips de ventas con acciones rápidas y la posibilidad de guardar clientes directamente desde el POS.',
    tag: 'Mejora',
  },
]

const tagColors: Record<string, string> = {
  Nuevo: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Mejora: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Pro: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen !== WHATS_NEW_VERSION) {
        setOpen(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const handleClose = () => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
    } catch {}
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative animate-scale-in w-full max-w-lg mx-4 max-h-[90vh] flex flex-col bg-[rgba(11,26,68,0.97)] border border-white/12 shadow-2xl rounded-2xl backdrop-blur-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/8 shrink-0">
          {/* Decorative gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/8 to-transparent rounded-t-2xl pointer-events-none" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/20">
                <Rocket className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Novedades en Stockia
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h2>
                <p className="text-xs text-white/50 mt-0.5">Versión {WHATS_NEW_VERSION} — Últimas mejoras</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 -mr-1 -mt-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
          {changes.map((item, i) => (
            <div
              key={i}
              className="flex gap-3.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-colors group"
            >
              <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-white/[0.06] text-indigo-300 group-hover:text-indigo-200 transition-colors">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{item.title}</span>
                  {item.tag && (
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                        tagColors[item.tag] || 'bg-white/10 text-white/60 border-white/10'
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/55 leading-relaxed mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            ¡Entendido, vamos! 🚀
          </button>
        </div>
      </div>
    </div>
  )
}

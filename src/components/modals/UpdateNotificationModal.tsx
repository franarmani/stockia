import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ArrowRight, Sparkles, X, Clock } from 'lucide-react'

interface UpdateNotificationModalProps {
  isOpen: boolean
  currentVersion: string
  newVersion: string
  onClose: () => void
  onReload: () => void
}

export default function UpdateNotificationModal({
  isOpen,
  currentVersion,
  newVersion,
  onClose,
  onReload,
}: UpdateNotificationModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="max-w-md w-full bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl relative text-foreground"
        >
          {/* Top accent glow */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Posponer actualización"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-7 space-y-5">
            {/* Header Icon & Title */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 text-blue-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="min-w-0 pr-6">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Nueva actualización disponible
                </h3>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  Hay una versión más reciente de CajaGo lista para usar.
                </p>
              </div>
            </div>

            {/* Version Transition Badge */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
              <span className="text-white/40">Versión actual:</span>
              <div className="flex items-center gap-2">
                <span className="text-white/60 font-semibold">{currentVersion || 'v1.0'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/25">
                  {newVersion}
                </span>
              </div>
            </div>

            {/* Notice */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
              Podés recargar ahora para aplicar las mejoras de inmediato, o continuar con tus ventas y actualizar más tarde.
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-white/50" />
                <span>Más tarde</span>
              </button>

              <button
                onClick={onReload}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-900/40 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar ahora</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

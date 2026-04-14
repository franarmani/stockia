import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ArrowRight, Zap, Info } from 'lucide-react'

interface UpdateNotificationModalProps {
  isOpen: boolean
  currentVersion: string
  newVersion: string
}

export default function UpdateNotificationModal({ isOpen, currentVersion, newVersion }: UpdateNotificationModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-xl w-full bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative"
        >
          {/* Decorative Top Glow */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 shadow-[0_0_20px_rgba(245,158,11,0.5)]" />

          {/* Header */}
          <div className="p-8 text-center pb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin-slow" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase italic">
              Actualización Crítica
            </h2>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
              Se ha detectado una nueva versión del sistema
            </p>
          </div>

          {/* Version Info */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black text-white/30 uppercase tracking-widest">
              v{currentVersion || 'Antigua'}
            </div>
            <ArrowRight className="w-4 h-4 text-white/10" />
            <div className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest">
              v{newVersion}
            </div>
          </div>

          {/* Instruction Image Container */}
          <div className="px-8 mb-8">
            <div className="relative group rounded-2xl overflow-hidden border border-white/5 bg-slate-950/50 aspect-video flex items-center justify-center">
              <img 
                src="/assets/hard-reload.png" 
                alt="Hard Reload Command" 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                 <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-amber-500 text-slate-950 font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-500/20">
                    Ctrl + Shift + R
                 </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8 space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
               <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
               <p className="text-xs text-white/60 leading-relaxed font-medium">
                Para aplicar las optimizaciones de diseño y el nuevo motor <span className="text-white font-bold tracking-tight uppercase">Bento v5</span>, es necesario forzar la limpieza de caché de tu navegador.
               </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full h-14 rounded-2xl bg-white text-slate-950 font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-3 active:scale-95 group"
              >
                <span>Recargar Aplicación</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-widest">
                <Info className="w-3 h-3" />
                <span>Recomendamos usar el comando manual para asegurar 100% de éxito</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

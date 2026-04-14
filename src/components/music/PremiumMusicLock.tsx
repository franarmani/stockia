import { Music, Crown, ShieldAlert, ArrowRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PremiumMusicLock() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 relative animate-pulse">
           <Music className="w-12 h-12 text-amber-500" />
           <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
             <Crown className="w-5 h-5 text-white" />
           </div>
        </div>
        
        {/* Floating elements for aesthetic */}
        <div className="absolute -left-12 top-0 w-8 h-8 rounded-full bg-primary/20 blur-xl animate-bounce" />
        <div className="absolute -right-8 bottom-4 w-12 h-12 rounded-full bg-blue-500/10 blur-xl animate-pulse" />
      </div>

      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Stockia <span className="text-amber-500">Music</span>
        </h1>
        
        <p className="text-white/60 text-lg leading-relaxed">
          Ambientá tu local sin salir del sistema. Creá playlists, programá música por horario y mejorá la experiencia de tus clientes con audio profesional.
        </p>

        <div className="grid grid-cols-1 gap-3 py-6">
          {[
            { icon: Zap, text: 'Playlists ilimitadas y personalizadas' },
            { icon: Music, text: 'Programación automática por horario' },
            { icon: ShieldAlert, text: 'Reproductor global persistente' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-left">
              <feature.icon className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm text-white/80 font-medium">{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center pt-4">
          <button 
            onClick={() => window.open('https://wa.me/5492915716099?text=Hola,%20quisiera%20mejorar%20mi%20plan%20a%20Premium%20para%20usar%20Stockia%20Music%20en%20mi%20negocio.', '_blank')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-500/20 active:scale-95"
          >
            MEJORAR A PREMIUM
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => navigate('/menu')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-sm transition-all"
          >
            Volver al menú
          </button>
        </div>
        
        <p className="text-[11px] text-white/25 pt-4 uppercase tracking-[0.2em] font-bold">
          Módulo Exclusivo para Usuarios Premium
        </p>
      </div>
    </div>
  )
}

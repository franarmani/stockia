import { Music, Crown, ShieldAlert, ArrowRight, Zap, PlayCircle, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PremiumMusicLock() {
  const navigate = useNavigate()

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center min-h-[80vh] p-6 text-center overflow-hidden">
      {/* ── Background Aesthetics ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[140px] animate-pulse delay-700" />
      </div>

      {/* ── Icon Section ── */}
      <div className="relative mb-10 select-none">
        <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-amber-600/5 flex items-center justify-center border border-white/10 relative group transition-transform duration-500 hover:scale-105">
           <Music className="w-12 h-12 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
           <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_8px_20px_rgba(245,158,11,0.4)] border border-white/20 animate-bounce-slow">
             <Crown className="w-6 h-6 text-slate-950" />
           </div>
           
           {/* Decorative Rings */}
           <div className="absolute inset-0 rounded-[2rem] border border-white/5 scale-110 opacity-50" />
           <div className="absolute inset-0 rounded-[2rem] border border-white/5 scale-125 opacity-20" />
        </div>
      </div>

      {/* ── Text Content ── */}
      <div className="max-w-2xl space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Módulo Exclusivo</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Sincronizá la energía de <br />
          tu negocio con <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Stockia Music</span>
        </h1>
        
        <p className="text-white/50 text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
          Creá la atmósfera perfecta. Controlá playlists, programá horarios y gestioná el audio de todos tus locales con un solo clic.
        </p>

        {/* ── Feature Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-8 max-w-xl mx-auto">
          {[
            { icon: PlayCircle, text: 'Playlists Inteligentes', desc: 'Diseñadas para tu rubro' },
            { icon: Zap, text: 'Control Total', desc: 'Reproductor cloud 24/7' },
            { icon: ShieldAlert, text: 'Seguridad', desc: 'Backup offline incluido' },
          ].map((feature, i) => (
            <div key={i} className="group flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-default text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-amber-500/20 transition-all">
                <feature.icon className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">{feature.text}</p>
              <p className="text-[10px] text-white/30">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center pt-2">
          <button 
            onClick={() => window.open('https://wa.me/5492915716099?text=Hola,%20quisiera%20mejorar%20mi%20plan%20a%20Premium%20para%20usar%20Stockia%20Music%20en%20mi%20negocio.', '_blank')}
            className="w-full sm:w-auto px-10 py-4.5 rounded-[1.5rem] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base flex items-center justify-center gap-3 transition-all shadow-[0_15px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.35)] active:scale-95 group"
          >
            ACTUALIZAR A PREMIUM
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
          
          <button 
            onClick={() => navigate('/menu')}
            className="w-full sm:w-auto px-8 py-4.5 rounded-[1.5rem] bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white font-bold text-sm transition-all"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  )
}

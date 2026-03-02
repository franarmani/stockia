import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1117 50%, #0a0a0a 100%)',
      }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-lg">
        {/* 404 Number */}
        <div className="relative mb-6">
          <h1
            className="text-[10rem] sm:text-[12rem] font-black leading-none tracking-tighter select-none"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.03) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500/30" strokeWidth={1.5} />
          </div>
        </div>

        {/* Message */}
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
          Página no encontrada
        </h2>
        <p className="text-white/50 text-sm sm:text-base mb-10 max-w-sm mx-auto leading-relaxed">
          La página que buscás no existe o fue movida. Verificá la URL o volvé al inicio.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 w-full sm:w-auto justify-center"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-sm font-medium rounded-xl transition-all duration-200 w-full sm:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver atrás
          </button>
        </div>

        {/* Footer brand */}
        <p className="mt-16 text-white/20 text-xs font-medium tracking-wider uppercase">
          STOCKIA
        </p>
      </div>
    </div>
  )
}

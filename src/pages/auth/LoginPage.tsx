import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import logo from '@/logo.png'
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShoppingCart, Package, BarChart3 } from 'lucide-react'

const FEATURES = [
  { icon: ShoppingCart, label: 'Punto de venta rápido' },
  { icon: Package, label: 'Control de stock en tiempo real' },
  { icon: BarChart3, label: 'Reportes y ganancias' },
]

const BG = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
const DOT_GRID = { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '28px 28px' }

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user && profile) navigate('/menu')
  }, [user, profile, navigate])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Completá todos los campos'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      // Navigate immediately — ProtectedRoute will show spinner while profile loads
      navigate('/menu')
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { toast.error('Ingresá tu email'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { toast.error('Error al enviar el email'); return }
    setResetSent(true)
  }

  /* ─── Shared input class ─── */
  const inputCls = 'w-full h-11 pl-10 pr-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ' +
    'bg-white text-slate-900 border border-slate-200 focus:ring-blue-500/30 focus:border-blue-500 ' +
    'lg:bg-white/10 lg:text-white lg:border-white/15 lg:placeholder-white/35 lg:focus:ring-white/20 lg:focus:border-white/40'

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      {/* ─── Desktop left brand panel ─── */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0" style={DOT_GRID} />
        {/* Glowing orb */}
        <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="relative z-10">
          <img src={logo} alt="STOCKIA" className="h-8 w-fit" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            El sistema de ventas<br />que tu negocio necesita
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-8">
            POS, stock, facturación AFIP y reportes. Todo en un solo lugar.
          </p>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="text-white/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© {new Date().getFullYear()} STOCKIA</p>
      </div>

      {/* ─── Right column / mobile full screen ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header — visible only on mobile */}
        <div className="lg:hidden flex flex-col px-6 pt-14 pb-8">
          <img src={logo} alt="STOCKIA" className="h-7 w-fit mb-10" />
          <h1 className="text-3xl font-black text-white leading-tight">
            {forgotMode ? 'Recuperar\ncontraseña' : 'Bienvenido\nde vuelta'}
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {forgotMode ? 'Te enviamos un link a tu email' : 'Ingresá tus datos para continuar'}
          </p>
        </div>

        {/* Form area — white card on mobile, transparent panel on desktop */}
        <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-10">
          <div className="w-full lg:max-w-sm bg-white lg:bg-transparent rounded-t-[28px] lg:rounded-none px-6 lg:px-0 pt-8 lg:pt-0 pb-12 lg:pb-0">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-7">
              <h2 className="text-2xl font-black text-white">
                {forgotMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {forgotMode ? 'Te enviamos un link a tu email' : 'Ingresá tus datos para continuar'}
              </p>
            </div>

            {/* Mobile heading inside card */}
            <div className="lg:hidden mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {forgotMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
              </h2>
            </div>

            {/* ─── Reset sent confirmation ─── */}
            {resetSent ? (
              <div className="rounded-xl p-4 text-center border border-green-500/30 bg-green-500/10">
                <p className="text-green-400 font-semibold text-sm mb-1">¡Email enviado!</p>
                <p className="text-green-300/70 text-xs">
                  Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false) }}
                  className="mt-3 text-xs text-indigo-400 lg:text-indigo-300 font-semibold hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>

            ) : forgotMode ? (
              /* ─── Forgot password form ─── */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  {loading ? 'Enviando...' : <>Enviar link de recuperación <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button
                  type="button" onClick={() => setForgotMode(false)}
                  className="w-full text-center text-sm text-slate-500 lg:text-white/40 hover:text-slate-700 lg:hover:text-white/70 transition-colors"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>

            ) : (
              /* ─── Login form ─── */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-slate-700 lg:text-white/70">Contraseña</label>
                    <button
                      type="button" onClick={() => setForgotMode(true)}
                      className="text-[12px] text-indigo-600 lg:text-indigo-300 hover:underline font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                    <input
                      type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 lg:text-white/35 hover:text-slate-600 lg:hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  {loading ? 'Ingresando...' : <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-slate-500 lg:text-white/40 mt-6">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="text-indigo-600 lg:text-indigo-300 font-semibold hover:underline">
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import logo from '@/logo.png'
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShoppingCart, Package, BarChart3, Zap, Shield, Smartphone } from 'lucide-react'

const FEATURES = [
  { icon: ShoppingCart, label: 'Punto de venta rápido e intuitivo', color: 'from-blue-500 to-cyan-400' },
  { icon: Package, label: 'Control de stock en tiempo real', color: 'from-violet-500 to-purple-400' },
  { icon: BarChart3, label: 'Reportes y ganancias al instante', color: 'from-amber-500 to-orange-400' },
  { icon: Shield, label: 'Facturación AFIP automática', color: 'from-emerald-500 to-green-400' },
  { icon: Smartphone, label: 'Funciona en celular y PC', color: 'from-rose-500 to-pink-400' },
]

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

  const inputCls = 'w-full h-12 pl-11 pr-4 rounded-xl text-sm bg-white/[0.07] text-white border border-white/[0.12] placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-500/40 transition-all'

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ─── Left panel — brand / features (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0b1a44 0%, #091233 40%, #07142f 100%)' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(29,185,84,0.4), transparent 70%)' }} />
        <div className="absolute bottom-20 right-10 w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)' }} />

        <div className="relative z-10 p-10 xl:p-14">
          <Link to="/" className="inline-block">
            <img src={logo} alt="STOCKIA" className="h-9 w-fit" />
          </Link>
        </div>

        <div className="relative z-10 px-10 xl:px-14 flex-1 flex flex-col justify-center max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold uppercase tracking-widest mb-6 w-fit">
            <Zap className="w-3 h-3" />
            Sistema #1 para comercios
          </div>

          <h1 className="text-4xl xl:text-[44px] font-black text-white leading-[1.1] mb-4 tracking-tight">
            El sistema de ventas que tu negocio
            <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent"> necesita</span>
          </h1>
          <p className="text-white/45 text-base leading-relaxed mb-10">
            POS, stock, facturación AFIP y reportes. Todo en un solo lugar, accesible desde cualquier dispositivo.
          </p>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3.5 group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0 shadow-lg opacity-90 group-hover:opacity-100 transition-opacity`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/65 text-sm font-medium group-hover:text-white/85 transition-colors">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-10 xl:p-14">
          <div className="flex items-center gap-6 text-white/20 text-xs">
            <span>© {new Date().getFullYear()} STOCKIA</span>
            <span>·</span>
            <span>+500 negocios activos</span>
          </div>
        </div>
      </div>

      {/* ─── Right panel — form ─── */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ background: 'linear-gradient(180deg, #0d1f4a 0%, #091440 50%, #07142f 100%)' }}>
        {/* Mobile header */}
        <div className="lg:hidden px-6 pt-12 pb-6">
          <Link to="/">
            <img src={logo} alt="STOCKIA" className="h-7 w-fit mb-8" />
          </Link>
          <h1 className="text-3xl font-black text-white leading-tight">
            {forgotMode ? 'Recuperar contraseña' : 'Bienvenido'}
          </h1>
          <p className="text-white/40 text-sm mt-1.5">
            {forgotMode ? 'Te enviamos un link a tu email' : 'Ingresá para continuar'}
          </p>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-12 pb-12 lg:pb-0">
          <div className="w-full max-w-[400px]">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-black text-white">
                {forgotMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
              </h2>
              <p className="text-white/40 text-sm mt-1.5">
                {forgotMode ? 'Te enviamos un link a tu email' : 'Ingresá tus datos para continuar'}
              </p>
            </div>

            {resetSent ? (
              <div className="rounded-2xl p-6 text-center border border-green-500/25 bg-green-500/10 backdrop-blur-sm">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-green-400 font-bold text-base mb-1.5">¡Email enviado!</p>
                <p className="text-green-300/60 text-sm leading-relaxed">
                  Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false) }}
                  className="mt-5 text-sm text-green-400/80 font-semibold hover:text-green-300 transition-colors"
                >
                  ← Volver al inicio de sesión
                </button>
              </div>

            ) : forgotMode ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email" className={inputCls} />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 gradient-primary shadow-lg shadow-green-900/30 hover:brightness-110 active:scale-[0.99]">
                  {loading ? 'Enviando...' : <>Enviar link de recuperación <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => setForgotMode(false)}
                  className="w-full text-center text-sm text-white/35 hover:text-white/60 transition-colors">
                  ← Volver al inicio de sesión
                </button>
              </form>

            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email" className={inputCls} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white/60">Contraseña</label>
                    <button type="button" onClick={() => setForgotMode(true)}
                      className="text-xs text-green-400/80 hover:text-green-400 font-medium transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      className={inputCls + ' !pr-11'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 gradient-primary shadow-lg shadow-green-900/30 hover:brightness-110 active:scale-[0.99]">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Ingresando...
                    </div>
                  ) : (
                    <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 my-7">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-white/20 uppercase tracking-wider font-medium">o</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <p className="text-center text-sm text-white/35">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="text-green-400 font-semibold hover:text-green-300 transition-colors">
                Crear cuenta gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

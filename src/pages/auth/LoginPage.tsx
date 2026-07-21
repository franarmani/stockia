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
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      )
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ])
      if (error) {
        toast.error('Email o contraseña incorrectos')
        setLoading(false)
      } else {
        // Navigate immediately — ProtectedRoute will show spinner while profile loads
        navigate('/menu')
      }
    } catch {
      toast.error('No se pudo conectar. Revisá tu conexión e intentá de nuevo.')
      setLoading(false)
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
  const inputCls = 'w-full h-12 pl-11 pr-3 rounded-xl text-sm bg-white/5 backdrop-blur-md text-foreground placeholder:text-white/40 border border-white/10 hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:shadow-[0_0_12px_rgba(0,240,255,0.2)] transition-all'

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Desktop left brand panel ─── */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/95 shadow-[0_0_12px_rgba(255,255,255,0.2)]">
            <img src="/og-image.png" alt="Icono STOCKIA" className="h-6 w-auto object-contain" />
          </div>
          <img src="/2.png" alt="STOCKIA" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert" />
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-4xl text-white leading-[0.95] mb-3 uppercase">
            El sistema de ventas<br />que tu negocio necesita
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-8">
            POS, stock, facturación AFIP y reportes. Todo en un solo lugar.
          </p>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-white/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© {new Date().getFullYear()} STOCKIA HUB</p>
      </div>

      {/* ─── Right column / mobile full screen ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header — visible only on mobile */}
        <div className="lg:hidden flex flex-col px-6 pt-14 pb-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/95 shadow-[0_0_12px_rgba(255,255,255,0.2)]">
              <img src="/og-image.png" alt="Icono STOCKIA" className="h-6 w-auto object-contain" />
            </div>
            <img src="/2.png" alt="STOCKIA" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert" />
          </div>
          <h1 className="font-display text-4xl text-white leading-[0.95] uppercase whitespace-pre-line">
            {forgotMode ? 'Recuperar\ncontraseña' : 'Bienvenido\nde vuelta'}
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {forgotMode ? 'Te enviamos un link a tu email' : 'Ingresá tus datos para continuar'}
          </p>
        </div>

        {/* Form area — white card on mobile, transparent panel on desktop */}
        <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-10">
          <div className="w-full lg:max-w-sm bg-surface-elevated lg:bg-transparent rounded-t-[28px] lg:rounded-none px-6 lg:px-0 pt-8 lg:pt-0 pb-12 lg:pb-0">
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
              <h2 className="text-lg font-bold text-white">
                {forgotMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
              </h2>
            </div>

            {/* ─── Reset sent confirmation ─── */}
            {resetSent ? (
              <div className="rounded-xl p-4 text-center border border-primary/30 bg-primary/10">
                <p className="text-primary font-semibold text-sm mb-1">¡Email enviado!</p>
                <p className="text-primary/70 text-xs">
                  Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false) }}
                  className="mt-3 text-xs text-primary font-semibold hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>

            ) : forgotMode ? (
              /* ─── Forgot password form ─── */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-white/70 mb-1.5">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email" required
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl font-bold text-sm text-background flex items-center justify-center gap-2 gradient-primary hover:scale-[1.02] shadow-[0_4px_16px_rgba(0,240,255,0.25)] hover:shadow-[0_4px_24px_rgba(0,240,255,0.4)] transition-all disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : <>Enviar link de recuperación <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button
                  type="button" onClick={() => setForgotMode(false)}
                  className="w-full text-center text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>

            ) : (
              /* ─── Login form ─── */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-white/70 mb-1.5">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email" required
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-white/70">Contraseña</label>
                    <button
                      type="button" onClick={() => setForgotMode(true)}
                      className="text-[12px] text-primary hover:underline font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password" required
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl font-bold text-sm text-background flex items-center justify-center gap-2 gradient-primary hover:scale-[1.02] shadow-[0_4px_16px_rgba(0,240,255,0.25)] hover:shadow-[0_4px_24px_rgba(0,240,255,0.4)] transition-all disabled:opacity-60"
                >
                  {loading ? 'Ingresando...' : <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-white/40 mt-6">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

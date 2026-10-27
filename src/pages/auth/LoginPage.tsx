import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import AuthShell from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'
import { TRIAL_DAYS } from '@/features/onboarding/registration'
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShoppingCart, Package, BarChart3 } from 'lucide-react'

const FEATURES = [
  { icon: ShoppingCart, label: 'Punto de venta ultra rápido' },
  { icon: Package, label: 'Control de stock en tiempo real' },
  { icon: BarChart3, label: 'Facturación AFIP y reportes' },
]

/** A dónde volver después de iniciar sesión (?next=/admin); solo rutas internas. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/menu'
}

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
    if (user && profile) navigate(nextPath())
  }, [user, profile, navigate])

  // Si la sesion se cerro porque no se pudo cargar el perfil, mostramos el
  // motivo real en vez de devolver al login sin explicacion.
  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('stockia_login_error')
      if (reason) {
        sessionStorage.removeItem('stockia_login_error')
        toast.error(reason, { duration: 9000 })
      }
    } catch {}
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Completá todos los campos'); return }
    setLoading(true)

    // El timeout evita que el botón quede colgado para siempre, pero antes
    // cualquier fallo caía en el mismo catch y siempre se culpaba a la
    // conexión, aunque el problema fuera otro.
    const TIMEOUT_MS = 20000
    let timedOut = false

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => { timedOut = true; reject(new Error('timeout')) }, TIMEOUT_MS)
      )
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])

      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('invalid login') || msg.includes('credentials')) {
          toast.error('Email o contraseña incorrectos')
        } else if (msg.includes('email not confirmed')) {
          toast.error('Falta confirmar el email de esta cuenta')
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          toast.error('Demasiados intentos seguidos. Esperá unos minutos.')
        } else if (msg.includes('fetch') || msg.includes('network')) {
          toast.error('No se pudo conectar con el servidor. Revisá tu conexión.')
        } else {
          // Sin esto, un error inesperado quedaba enmascarado como falla de red.
          toast.error(`No se pudo iniciar sesión: ${error.message}`, { duration: 8000 })
        }
        console.warn('[Login] error:', error)
        setLoading(false)
        return
      }

      // Navigate immediately — ProtectedRoute will show spinner while profile loads
      navigate(nextPath())
    } catch (err: any) {
      console.warn('[Login] excepción:', err)

      if (timedOut) {
        // Puede que la sesión haya quedado abierta igual: si es así, entramos.
        const { data } = await supabase.auth.getSession()
        if (data.session) { navigate(nextPath()); return }
        toast.error('El servidor tardó demasiado en responder. Probá de nuevo.', { duration: 8000 })
      } else {
        toast.error(`No se pudo conectar: ${err?.message || 'error desconocido'}`, { duration: 8000 })
      }
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
  const inputCls = 'w-full h-12 pl-11 pr-3 rounded-xl text-sm bg-white/[0.04] text-[#FCFCFD] placeholder:text-slate-500 border border-white/[0.10] hover:border-white/20 focus:outline-none focus:ring-[3px] focus:ring-[#9aa9ff]/15 focus:border-[#9aa9ff]/60 transition-all'

  return (
    <AuthShell
      eyebrow={forgotMode ? 'Recuperar acceso' : 'Ingresá a tu negocio'}
      title={forgotMode ? 'Recuperá tu' : 'Bienvenido'}
      accent={forgotMode ? 'contraseña.' : 'de vuelta.'}
      subtitle={forgotMode ? 'Te mandamos un link a tu email para elegir una nueva.' : 'Ventas, stock, caja y facturación, donde los dejaste.'}
      footer={
        <p className="text-sm text-slate-400">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="font-semibold text-[#9aa9ff] hover:text-white">Probá {TRIAL_DAYS} días gratis</Link>
        </p>
      }
    >
            {/* ─── Reset sent confirmation ─── */}
            {resetSent ? (
              <div className="rounded-xl p-4 text-center border border-[#9aa9ff]/30 bg-[#9aa9ff]/10">
                <p className="text-primary font-semibold text-sm mb-1">Email enviado</p>
                <p className="text-[#9CA6BA] text-xs">
                  Revisá tu bandeja de entrada y seguí el link para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false) }}
                  className="mt-3 text-xs text-[#9aa9ff] font-semibold hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>

            ) : forgotMode ? (
              /* ─── Forgot password form ─── */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#FCFCFD]/70 mb-1.5">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA6BA] group-focus-within:text-[#9aa9ff] transition-colors" />
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
                  className="cg-btn-primary w-full h-12 text-sm"
                >
                  {loading ? 'Enviando...' : <>Enviar link de recuperación <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button
                  type="button" onClick={() => setForgotMode(false)}
                  className="w-full text-center text-sm text-[#9CA6BA] hover:text-[#FCFCFD] transition-colors"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>

            ) : (
              /* ─── Login form ─── */
              <form onSubmit={handleLogin} className="space-y-4">
                <GoogleButton />
                <div>
                  <label className="block text-[13px] font-medium text-[#FCFCFD]/70 mb-1.5">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA6BA] group-focus-within:text-[#9aa9ff] transition-colors" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com" autoComplete="email" required
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-[#FCFCFD]/70">Contraseña</label>
                    <button
                      type="button" onClick={() => setForgotMode(true)}
                      className="text-[12px] text-[#9aa9ff] hover:text-white hover:underline font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA6BA] group-focus-within:text-[#9aa9ff] transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password" required
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA6BA] hover:text-[#FCFCFD] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="cg-btn-primary w-full h-12 text-sm"
                >
                  {loading ? 'Ingresando...' : <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

    </AuthShell>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { checkConnectivity, isNetworkError } from '@/sync/connectivity'
import { getOfflineSnapshot, rememberOfflineCredential, verifyOfflineCredential } from '@/desktop/offlineAuth'
import { cacheBusiness, cacheOfflineUser, cacheProfile } from '@/lib/sessionCache'
import { toast } from 'sonner'
import RegistrationForm from '@/features/onboarding/RegistrationForm'
import { PUBLIC_WEB_URL } from '@/config/publicUrls'
import { openExternal } from '@/desktop/openExternal'
import AuthShell from '@/components/auth/AuthShell'
import { Mail, Lock, User, Store, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'

interface DesktopAuthProps {
  initialTab?: 'login' | 'register'
}

export default function DesktopAuthPage({ initialTab = 'login' }: DesktopAuthProps) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')


  // If already logged in, redirect straight to work
  useEffect(() => {
    if (user && profile) {
      navigate('/menu', { replace: true })
    }
  }, [user, profile, navigate])

  // Login handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast.error('Completá email y contraseña')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })

      if (error) {
        if (isNetworkError(error) || !(await checkConnectivity())) {
          await handleOfflineLogin()
          return
        }
        const msg = error.message.toLowerCase()
        if (msg.includes('invalid') || msg.includes('credential')) {
          toast.error('Email o contraseña incorrectos')
        } else if (msg.includes('rate limit')) {
          toast.error('Demasiados intentos. Esperá unos segundos.')
        } else {
          toast.error(error.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        await rememberOfflineCredential(loginEmail, loginPassword, data.user.id).catch((err) =>
          console.warn('[Auth] no se pudo guardar el acceso offline:', err))
      }
      toast.success('Iniciando sesión...')
      navigate('/menu', { replace: true })
    } catch (err: any) {
      if (isNetworkError(err) || !(await checkConnectivity())) {
        await handleOfflineLogin()
        return
      }
      toast.error(err?.message || 'Error al conectar')
      setLoading(false)
    }
  }

  // Sin servidor: solo entra un usuario que ya ingresó online en este equipo, con su contraseña.
  async function handleOfflineLogin() {
    try {
      const userId = await verifyOfflineCredential(loginEmail, loginPassword)
      const snapshot = userId ? await getOfflineSnapshot(userId) : null
      if (!snapshot) {
        toast.error('Sin conexión: solo pueden ingresar usuarios que ya iniciaron sesión en este equipo. Revisá email y contraseña.', { duration: 8000 })
        return
      }
      cacheOfflineUser(snapshot.user)
      cacheProfile(snapshot.profile)
      if (snapshot.business) {
        cacheBusiness(snapshot.business)
        useBusinessStore.getState().setBusiness(snapshot.business as any)
      }
      useAuthStore.getState().setUser(snapshot.user as any)
      useAuthStore.getState().setProfile(snapshot.profile as any)
      toast.success('Ingreso sin conexión · todo se sincroniza al volver Internet')
      navigate('/menu', { replace: true })
    } catch (err) {
      console.error('[Auth] offline login failed:', err)
      toast.error('No se pudo ingresar sin conexión')
    } finally {
      setLoading(false)
    }
  }


  // Forgot password handler
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail) {
      toast.error('Ingresá tu email')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: `${PUBLIC_WEB_URL}/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error('Error al enviar email de recuperación')
      return
    }
    setResetSent(true)
  }

  const inputCls =
    'w-full h-11 pl-10 pr-3 rounded-[10px] text-sm bg-white/[0.035] text-[#FCFCFD] placeholder:text-[#9CA6BA]/60 border border-white/[0.10] hover:border-white/20 focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary/70 transition-all'

  return (
    <AuthShell
      wide={activeTab === 'register' && !forgotMode}
      brandHref={null}
      brandTag="DESKTOP"
      eyebrow={forgotMode ? 'Recuperar acceso' : activeTab === 'register' ? '5 días gratis con todo Premium' : 'CajaGo para Windows'}
      title={forgotMode ? 'Recuperá tu' : activeTab === 'register' ? 'Creá tu cuenta.' : 'Bienvenido'}
      accent={forgotMode ? 'contraseña.' : activeTab === 'register' ? 'Tu negocio, en orden.' : 'de vuelta.'}
      subtitle={forgotMode ? 'Te mandamos un link a tu email para elegir una nueva.' : activeTab === 'register' ? 'Completá los datos una sola vez y empezá a vender hoy.' : 'Funciona aunque se corte internet. Todo se sincroniza solo.'}
    >
      <div className="select-none">
        
        {/* Tab Switcher */}
        {!forgotMode && (
          <div className="flex bg-white/[0.04] p-1 rounded-xl mb-6 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-[#0a0e15] shadow-[0_8px_24px_rgba(154,169,255,0.25)]'
                  : 'text-[#9CA6BA] hover:text-[#FCFCFD]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'register'
                  ? 'bg-white text-[#0a0e15] shadow-[0_8px_24px_rgba(154,169,255,0.25)]'
                  : 'text-[#9CA6BA] hover:text-[#FCFCFD]'
              }`}
            >
              Registrar negocio
            </button>
          </div>
        )}

        {/* ─── FORGOT PASSWORD MODE ─── */}
        {forgotMode ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Recuperar contraseña</h2>
            <p className="text-xs text-slate-400 mb-6">
              Ingresá tu email y te enviaremos las instrucciones de restablecimiento.
            </p>

            {resetSent ? (
              <div className="bg-[#947FF8]/10 border border-[#947FF8]/25 rounded-xl p-4 text-center">
                <p className="text-[#947FF8] font-bold text-xs mb-1">¡Correo enviado con éxito!</p>
                <p className="text-[11px] text-[#9CA6BA]">
                  Revisá tu casilla de correo y seguí el enlace para restablecerla.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false)
                    setResetSent(false)
                  }}
                  className="mt-4 text-xs font-semibold text-[#947FF8] hover:underline"
                >
                  Volver a iniciar sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9CA6BA] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tucorreo@comercio.com"
                    className={inputCls}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="cg-btn-primary w-full h-12 text-sm"
                >
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="text-xs text-[#9CA6BA] hover:text-[#FCFCFD]"
                  >
                    Volver a iniciar sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : activeTab === 'login' ? (
          /* ─── LOGIN TAB ─── */
          <div>
            <h2 className="text-xl font-bold text-[#FCFCFD] mb-1">Bienvenido a CajaGo</h2>
            <p className="text-xs text-[#9CA6BA] mb-5">Ingresá tus credenciales para acceder a tu terminal.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9CA6BA] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tucorreo@comercio.com"
                  className={inputCls}
                  required
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA6BA] absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contraseña"
                  className={`${inputCls} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#9CA6BA] hover:text-[#FCFCFD] p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-[#947FF8] hover:text-[#B785F3] hover:underline text-[11px]"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cg-btn-primary w-full h-12 text-sm mt-2"
              >
                <span>{loading ? 'Ingresando...' : 'Ingresar a CajaGo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* ─── REGISTER TAB ─── */
          <div>
                        <p className="text-xs text-slate-400 mb-5">Después de la prueba elegís Básico ($38.000) o Premium ($70.000).</p>

            <RegistrationForm
              onRegistered={async ({ email, password }) => {
                // Entra directo y deja guardado el acceso sin conexión para este equipo.
                const { data } = await supabase.auth.signInWithPassword({ email, password })
                if (data.user) await rememberOfflineCredential(email, password, data.user.id).catch(() => {})
                toast.success('¡Tu negocio está listo! Tenés 5 días gratis con todo Premium.')
                navigate('/menu', { replace: true })
              }}
              legalNotice={
                <p className="text-[11px] text-center text-[#9CA6BA]">
                  Al crear tu cuenta aceptás los{' '}
                  <button type="button" onClick={() => openExternal(`${PUBLIC_WEB_URL}/terminos`)} className="underline hover:text-white">Términos</button>
                  {' '}y la{' '}
                  <button type="button" onClick={() => openExternal(`${PUBLIC_WEB_URL}/privacidad`)} className="underline hover:text-white">Política de privacidad</button>.
                </p>
              }
            />
          </div>
        )}

      </div>
    </AuthShell>
  )
}

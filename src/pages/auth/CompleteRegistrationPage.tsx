import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import AuthShell from '@/components/auth/AuthShell'
import RegistrationForm from '@/features/onboarding/RegistrationForm'
import { TRIAL_DAYS } from '@/features/onboarding/registration'

/** Quien entra por primera vez con Google completa los datos de su negocio (2 pasos). */
export default function CompleteRegistrationPage() {
  const navigate = useNavigate()
  const { user, profile, loading, signOut } = useAuthStore()

  // Si el usuario cerró la pestaña en medio del alta, vuelve acá al entrar de nuevo.
  useEffect(() => {
    if (!loading && user && !profile) useAuthStore.getState().setNeedsOnboarding(true)
  }, [loading, user, profile])

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (profile) return <Navigate to="/menu" replace />

  const fullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '')
  return (
    <AuthShell
      wide
      eyebrow={`${TRIAL_DAYS} días gratis con todo incluido`}
      title="Casi listo."
      accent="Contanos de tu negocio."
      subtitle={`Entraste con ${user.email}. Faltan los datos del negocio y empezás a vender.`}
      footer={
        <button
          type="button"
          onClick={async () => { await signOut(); navigate('/login') }}
          className="text-sm text-slate-400 hover:text-white"
        >
          Usar otra cuenta
        </button>
      }
    >
      <RegistrationForm
        oauthUser={{ email: user.email ?? '', fullName }}
        onRegistered={async () => {
          // El perfil recién creado se carga desde el servidor al entrar.
          useAuthStore.getState().setNeedsOnboarding(false)
          const { data } = await supabase.auth.getSession()
          if (data.session) window.location.assign('/menu')
          else toast.error('Tu sesión venció. Ingresá de nuevo.')
        }}
      />
    </AuthShell>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import AuthShell from '@/components/auth/AuthShell'
import { TRIAL_DAYS } from '@/features/onboarding/registration'
import RegistrationForm from '@/features/onboarding/RegistrationForm'
import { Mail, Lock, User, Store, ArrowRight, Eye, EyeOff, Check, Gift, MapPin } from 'lucide-react'

const BENEFITS = [
  'Sin tarjeta de crédito',
  'Listo en 2 minutos',
  'Soporte directo incluido',
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inputCls =
    'w-full h-12 pl-11 pr-3 rounded-[10px] text-sm bg-white/[0.035] text-[#FCFCFD] placeholder:text-[#9CA6BA]/60 border border-white/[0.10] hover:border-white/20 focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary/70 transition-all'

  return (
    <AuthShell
      wide
      eyebrow={`${TRIAL_DAYS} días gratis con todo Premium`}
      title="Creá tu cuenta."
      accent="Tu negocio, en orden."
      subtitle="Completá los datos una sola vez y empezá a vender hoy. Sin tarjeta."
      footer={
        <p className="text-sm text-slate-400">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-semibold text-[#9aa9ff] hover:text-white">Ingresá</Link>
        </p>
      }
    >
            <RegistrationForm
              initialReferral={searchParams.get('ref') || ''}
              onRegistered={async ({ referralApplied }) => {
                if (referralApplied) toast.success('¡Código de referido aplicado! 10% off tu primer mes')
                await supabase.auth.signOut()
                toast.success('¡Cuenta creada! Ahora iniciá sesión')
                navigate('/login')
              }}
              legalNotice={
                <p className="text-[11px] text-center text-[#9CA6BA]">
                  Al crear tu cuenta aceptás los <Link to="/terminos" className="underline hover:text-white">Términos</Link> y la <Link to="/privacidad" className="underline hover:text-white">Política de privacidad</Link>.
                </p>
              }
            />
    </AuthShell>
  )
}

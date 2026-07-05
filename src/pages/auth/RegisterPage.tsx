import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import logo from '@/logo.png'
import { Mail, Lock, User, Store, ArrowRight, Eye, EyeOff, Check, Gift } from 'lucide-react'

const BENEFITS = [
  'Sin tarjeta de crédito',
  'Configuración en 2 minutos',
  'Soporte incluido',
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ fullName: '', businessName: '', email: '', password: '', referralCode: searchParams.get('ref') || '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fullName || !form.businessName || !form.email || !form.password) {
      toast.error('Completá todos los campos'); return
    }
    if (form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }

    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
      })
      if (authError || !authData.user) { toast.error(authError?.message || 'Error al registrar'); setLoading(false); return }

      const userId = authData.user.id

      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 7)

      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          name: form.businessName.trim(),
          email: form.email,
          subscription_status: 'trial',
          trial_ends_at: trialEnd.toISOString(),
        })
        .select().single()

      if (bizError || !business) { toast.error('Error al crear negocio'); setLoading(false); return }

      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: userId,
          business_id: business.id,
          name: form.fullName.trim(),
          email: form.email,
          role: 'admin',
        })

      if (profileError) { toast.error('Error al crear perfil'); setLoading(false); return }

      if (form.referralCode.trim()) {
        const { data: referral } = await supabase.rpc('redeem_referral_code', {
          p_code: form.referralCode.trim(),
          p_business_id: business.id,
        })
        if (referral?.ok) toast.success('¡Código de referido aplicado! 10% off tu primer mes')
      }

      await supabase.auth.signOut()
      toast.success('¡Cuenta creada! Ahora iniciá sesión')
      navigate('/login')
    } catch { toast.error('Error inesperado') }
    setLoading(false)
  }

  const inputCls = 'w-full h-11 pl-10 pr-3 rounded-xl text-sm bg-white/5 text-foreground placeholder:text-muted-foreground border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Desktop left brand panel ─── */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <img src={logo} alt="STOCKIA HUB" className="h-8 w-auto self-start" />
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-4xl text-white leading-[0.95] mb-3 uppercase">
            Empezá a vender<br />de forma profesional
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-8">
            7 días de prueba gratis. Sin tarjeta de crédito.
          </p>
          <div className="space-y-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-white/70 text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© {new Date().getFullYear()} STOCKIA HUB</p>
      </div>

      {/* ─── Right column / mobile full screen ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden flex flex-col px-6 pt-14 pb-8">
          <img src={logo} alt="STOCKIA HUB" className="h-7 w-auto self-start mb-10" />
          <h1 className="font-display text-4xl text-white leading-[0.95] uppercase">Crear cuenta</h1>
          <p className="text-white/50 text-sm mt-2">7 días gratis, sin compromiso</p>
        </div>

        {/* Form area */}
        <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-10">
          <div className="w-full lg:max-w-sm bg-surface-elevated lg:bg-transparent rounded-t-[28px] lg:rounded-none px-6 lg:px-0 pt-8 lg:pt-0 pb-12 lg:pb-0">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-7">
              <h2 className="text-2xl font-black text-white">Crear cuenta</h2>
              <p className="text-white/50 text-sm mt-1">7 días gratis, sin compromiso</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-white/70 mb-1.5">Tu nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Juan Pérez" autoComplete="name" required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-white/70 mb-1.5">Nombre del negocio</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Mi Comercio" autoComplete="organization" required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-white/70 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com" autoComplete="email" required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-white/70 mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" autoComplete="new-password" required minLength={6}
                    className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-white/70 mb-1.5">Código de referido (opcional)</label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input type="text" value={form.referralCode} onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
                    placeholder="Ej: ABC123" autoComplete="off" className={inputCls} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover transition-all disabled:opacity-60"
              >
                {loading ? 'Creando cuenta...' : <>Crear cuenta gratis <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-[13px] text-white/40 mt-6">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import logo from '@/logo.png'
import { Mail, Lock, User, Store, ArrowRight, Eye, EyeOff, Check } from 'lucide-react'

const BG = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
const DOT_GRID = { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '28px 28px' }

const BENEFITS = [
  'Sin tarjeta de crédito',
  'Configuración en 2 minutos',
  'Soporte incluido',
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', businessName: '', email: '', password: '' })
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

      await supabase.auth.signOut()
      toast.success('¡Cuenta creada! Ahora iniciá sesión')
      navigate('/login')
    } catch { toast.error('Error inesperado') }
    setLoading(false)
  }

  const inputCls = 'w-full h-11 pl-10 pr-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ' +
    'bg-white text-slate-900 border border-slate-200 focus:ring-blue-500/30 focus:border-blue-500 ' +
    'lg:bg-white/10 lg:text-white lg:border-white/15 lg:placeholder-white/35 lg:focus:ring-white/20 lg:focus:border-white/40'

  return (
    <div className="min-h-screen flex" style={{ background: BG }}>
      {/* ─── Desktop left brand panel ─── */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0" style={DOT_GRID} />
        <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="relative z-10">
          <img src={logo} alt="STOCKIA" className="h-8 w-fit" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            Empezá a vender<br />de forma profesional
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-8">
            7 días de prueba gratis. Sin tarjeta de crédito.
          </p>
          <div className="space-y-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-white/70 text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© {new Date().getFullYear()} STOCKIA</p>
      </div>

      {/* ─── Right column / mobile full screen ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden flex flex-col px-6 pt-14 pb-8">
          <img src={logo} alt="STOCKIA" className="h-7 w-fit mb-10" />
          <h1 className="text-3xl font-black text-white leading-tight">Crear cuenta</h1>
          <p className="text-white/50 text-sm mt-2">7 días gratis, sin compromiso</p>
        </div>

        {/* Form area */}
        <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-10">
          <div className="w-full lg:max-w-sm bg-white lg:bg-transparent rounded-t-[28px] lg:rounded-none px-6 lg:px-0 pt-8 lg:pt-0 pb-12 lg:pb-0">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-7">
              <h2 className="text-2xl font-black text-white">Crear cuenta</h2>
              <p className="text-white/50 text-sm mt-1">7 días gratis, sin compromiso</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Tu nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                  <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Juan Pérez" autoComplete="name" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Nombre del negocio</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                  <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Mi Comercio" autoComplete="organization" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com" autoComplete="email" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 lg:text-white/70 mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 lg:text-white/35" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                    className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 lg:text-white/35 hover:text-slate-600 lg:hover:text-white/70 transition-colors">
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
                {loading ? 'Creando cuenta...' : <>Crear cuenta gratis <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-[13px] text-slate-500 lg:text-white/40 mt-6">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-indigo-600 lg:text-indigo-300 font-semibold hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import logo from '@/logo.png'
import { Mail, Lock, User, Store, ArrowRight, Eye, EyeOff, Check, Zap, ShoppingCart, FileText, BarChart3, Smartphone } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: ShoppingCart, text: 'Punto de venta completo' },
  { icon: FileText, text: 'Facturación AFIP automática' },
  { icon: BarChart3, text: 'Reportes de ganancia real' },
  { icon: Smartphone, text: 'Funciona en celular y PC' },
]

const BENEFITS = [
  'Sin tarjeta de crédito',
  'Configuración en 2 minutos',
  'Soporte incluido',
  'Cancelá cuando quieras',
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

  const inputCls = 'w-full h-12 pl-11 pr-4 rounded-xl text-sm bg-white/[0.07] text-white border border-white/[0.12] placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-500/40 transition-all'

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ─── Left panel — brand / benefits (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0b1a44 0%, #091233 40%, #07142f 100%)' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-40 -right-20 w-[500px] h-[500px] rounded-full opacity-25 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(29,185,84,0.5), transparent 70%)' }} />
        <div className="absolute bottom-10 -left-20 w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)' }} />

        <div className="relative z-10 p-10 xl:p-14">
          <Link to="/" className="inline-block">
            <img src={logo} alt="STOCKIA" className="h-9 w-fit" />
          </Link>
        </div>

        <div className="relative z-10 px-10 xl:px-14 flex-1 flex flex-col justify-center max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold uppercase tracking-widest mb-6 w-fit">
            <Zap className="w-3 h-3" />
            7 días gratis
          </div>

          <h1 className="text-4xl xl:text-[44px] font-black text-white leading-[1.1] mb-4 tracking-tight">
            Empezá a vender
            <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent"> de forma profesional</span>
          </h1>
          <p className="text-white/45 text-base leading-relaxed mb-10">
            Todo lo que tu negocio necesita para vender, facturar y crecer. Sin complicaciones.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <Icon className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-white/60 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div className="space-y-2.5">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-white/55 text-sm">{b}</span>
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
          <h1 className="text-3xl font-black text-white leading-tight">Crear cuenta</h1>
          <p className="text-white/40 text-sm mt-1.5">7 días gratis, sin compromiso</p>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-12 pb-12 lg:pb-0">
          <div className="w-full max-w-[400px]">
            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-black text-white">Crear cuenta</h2>
              <p className="text-white/40 text-sm mt-1.5">7 días gratis, sin compromiso</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Tu nombre</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                  <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Juan Pérez" autoComplete="name" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Nombre del negocio</label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                  <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Mi Comercio" autoComplete="organization" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com" autoComplete="email" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" autoComplete="new-password"
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
                    Creando cuenta...
                  </div>
                ) : (
                  <>Crear cuenta gratis <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Mobile benefits */}
            <div className="lg:hidden flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-5">
              {BENEFITS.map((b) => (
                <span key={b} className="text-xs text-white/30 flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500/60" /> {b}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 my-7">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-white/20 uppercase tracking-wider font-medium">o</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <p className="text-center text-sm text-white/35">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-green-400 font-semibold hover:text-green-300 transition-colors">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

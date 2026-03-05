import { Link, Navigate } from 'react-router-dom'
import logoSolo from '@/logosolo.png'
import logo from '@/logo.png'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  ShoppingCart, BarChart3, Package, Users,
  Shield, ArrowRight, Check, Smartphone,
  FileText, Wallet, Zap, Activity, Bell,
  X, ChevronDown, Star, Clock, TrendingUp,
  CreditCard, Lock, Wifi, AlertTriangle,
  CheckCircle2, Store, Menu as MenuIcon,
  Play, Sparkles, Globe,
} from 'lucide-react'

/* ─────────────── SVG: Argentina flag ─────────────── */
function ArgentinaFlag({ className = 'w-4 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Argentina">
      <rect width="32" height="22" rx="2" fill="#6CACE4" />
      <rect y="7" width="32" height="8" fill="#fff" />
      <circle cx="16" cy="11" r="2.5" fill="#F6B40E" />
      <path d="M16 7.5l.3 1h1l-.8.6.3 1-.8-.6-.8.6.3-1-.8-.6h1z" fill="#F6B40E" />
    </svg>
  )
}

/* ─────────────── SCROLL REVEAL HOOK ─────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─────────────── ANIMATED COUNTER ─────────────── */
function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const dur = 1800
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(end * ease))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [end])
  return <span ref={ref}>{prefix}{val.toLocaleString('es-AR')}{suffix}</span>
}

/* ─────────────── DATA ─────────────── */

const painPoints = [
  {
    icon: AlertTriangle,
    gradient: 'from-amber-500 to-orange-600',
    title: 'Perdés ventas por no saber qué tenés en stock',
    desc: 'Decís que sí y después no encontrás el producto. O lo vendés dos veces.',
  },
  {
    icon: Clock,
    gradient: 'from-red-500 to-rose-600',
    title: 'Hacés las facturas a mano o en papel',
    desc: 'Tardás, errás y después tenés problemas con AFIP que te cuestan caro.',
  },
  {
    icon: TrendingUp,
    gradient: 'from-rose-500 to-pink-600',
    title: 'No sabés si tu negocio gana o pierde',
    desc: 'Cerrás el mes y no tenés idea cuánto ganaste realmente después de gastos.',
  },
  {
    icon: Users,
    gradient: 'from-violet-500 to-purple-600',
    title: 'Los clientes te deben y no podés llevar el control',
    desc: 'Cuadernos, Excel o memoria. Siempre se escapa algo y los números no cierran.',
  },
]

const features = [
  { icon: ShoppingCart, gradient: 'from-blue-500 to-cyan-500', title: 'Punto de venta', desc: 'Vendé rápido con búsqueda inteligente y lector de código de barras. Cada venta en segundos.' },
  { icon: Package, gradient: 'from-violet-500 to-purple-500', title: 'Control de stock', desc: 'Inventario en tiempo real con alertas de mínimos y gestión de compras a proveedores.' },
  { icon: FileText, gradient: 'from-indigo-500 to-blue-500', title: 'Facturación AFIP', desc: 'Factura A, B y C con CAE automático. Notas de crédito incluidas. 100% legal.' },
  { icon: BarChart3, gradient: 'from-orange-500 to-amber-500', title: 'Reportes y ganancias', desc: 'Ventas, ganancia por producto y métricas del negocio con gráficos claros y exportables.' },
  { icon: Users, gradient: 'from-cyan-500 to-teal-500', title: 'Clientes y cta. cte.', desc: 'Registrá clientes, historial completo de compras, saldo de cuenta corriente y deudas.' },
  { icon: Smartphone, gradient: 'from-green-500 to-emerald-500', title: 'Modo offline (PWA)', desc: 'Instalable en celular y PC. Si se corta internet seguís vendiendo con tickets — las ventas se sincronizan al volver la conexión.' },
  { icon: Wallet, gradient: 'from-rose-500 to-pink-500', title: 'Caja diaria', desc: 'Apertura y cierre de caja con arqueo automático. Resumen del día al instante.' },
  { icon: Activity, gradient: 'from-emerald-500 to-green-500', title: 'Salud del negocio', desc: 'Score en tiempo real: stock crítico, deudas, facturas pendientes y alertas inteligentes.' },
  { icon: Bell, gradient: 'from-purple-500 to-violet-500', title: 'Notificaciones', desc: 'Alertas automáticas de stock bajo, deudas altas, productos sin costo y más.' },
]

const steps = [
  {
    num: '01',
    title: 'Creá tu cuenta',
    desc: 'Registrate en 2 minutos. Sin tarjeta, sin letra chica. 7 días para probarlo todo.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    num: '02',
    title: 'Cargá tus productos',
    desc: 'Importá desde Excel o cargalos uno a uno. Stock, precios y categorías en orden.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    num: '03',
    title: 'Empezá a vender',
    desc: 'Punto de venta listo, facturación automática y reportes en tiempo real desde el día uno.',
    gradient: 'from-violet-500 to-purple-500',
  },
]

const testimonials = [
  {
    name: 'Marcelo R.',
    biz: 'Ferretería El Clavo',
    city: 'Córdoba',
    text: 'Antes llevaba el stock en un cuaderno y siempre había errores. Con STOCKIA sé exactamente qué tengo y cuándo pedir. Recuperé lo que pagaba en un mes.',
    stars: 5,
    highlight: 'Recuperé la inversión en el primer mes',
  },
  {
    name: 'Valeria M.',
    biz: 'Kiosco y Almacén',
    city: 'Buenos Aires',
    text: 'La facturación AFIP era mi pesadilla. Ahora aprieto un botón y listo. El sistema es rapidísimo para el POS, mis clientes no esperan nada.',
    stars: 5,
    highlight: 'La factura AFIP ahora es automática',
  },
  {
    name: 'Diego T.',
    biz: 'Distribuidora Norte',
    city: 'Rosario',
    text: 'Manejo 3 vendedores desde el celular. Los reportes me dicen exactamente qué está vendiendo cada uno y cuánto gana el negocio realmente.',
    stars: 5,
    highlight: 'Controlo todo desde el celular',
  },
]

const planFeatures = [
  { text: 'Punto de venta completo + código de barras', hot: false },
  { text: 'Facturación electrónica AFIP (A, B y C)', hot: true },
  { text: 'Control de inventario en tiempo real', hot: false },
  { text: 'Reportes de ventas, ganancia y stock', hot: false },
  { text: 'Gestión de clientes y cuenta corriente', hot: false },
  { text: 'Caja diaria con arqueo automático', hot: false },
  { text: 'Usuarios ilimitados', hot: false },
  { text: 'Modo offline: vendé sin internet (tickets, sin AFIP)', hot: true },
  { text: 'Importación de productos por Excel', hot: false },
  { text: 'Soporte por WhatsApp', hot: false },
]

const faqs = [
  {
    q: '¿Necesito conocimientos técnicos para usarlo?',
    a: 'No. STOCKIA está diseñado para dueños de negocios, no para técnicos. Si sabés usar el celular, sabés usar STOCKIA. En 15 minutos ya estás vendiendo.',
  },
  {
    q: '¿La facturación AFIP es realmente automática?',
    a: 'Sí. Configurás tu CUIT y punto de venta una sola vez y el sistema genera el CAE, arma la factura y te la manda al cliente. Sin trámites extra.',
  },
  {
    q: '¿Qué pasa si me quedo sin internet?',
    a: 'El modo offline te permite seguir vendiendo aunque se corte la conexión. Las ventas se sincronizan automáticamente cuando vuelve el internet.',
  },
  {
    q: '¿Puedo importar mis productos desde Excel?',
    a: 'Sí. Podés subir un archivo Excel con todos tus productos, categorías, precios y stock de una sola vez. Nada de cargar todo a mano.',
  },
  {
    q: '¿Qué pasa después del período de prueba?',
    a: 'Te avisamos antes de que venza. Si decidís continuar, suscribís con tarjeta o transferencia. Si no, podés exportar todos tus datos y no te cobramos nada.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí, sin penalidades ni burocracia. Cancelás en un clic desde la configuración de tu cuenta.',
  },
]

const comparisons = [
  { label: 'Punto de venta ágil', them: false, us: true },
  { label: 'Facturación AFIP integrada', them: false, us: true },
  { label: 'Stock en tiempo real', them: false, us: true },
  { label: 'Modo offline', them: false, us: true },
  { label: 'Reportes de ganancia real', them: false, us: true },
  { label: 'Sin instalación ni servidor', them: false, us: true },
  { label: 'Actualizaciones automáticas', them: false, us: true },
  { label: 'Sin costos ocultos', them: false, us: true },
]

/* ─────────────── FAQ ITEM ─────────────── */
function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${
        open
          ? 'bg-white/[0.06] border-green-500/20 shadow-lg shadow-green-900/10'
          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]'
      }`}
    >
      <button
        className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4">
          <span className={`text-xs font-black w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
            open ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.06] text-white/25'
          }`}>
            {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="text-sm sm:text-[15px] font-semibold text-white leading-snug">{q}</span>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
          open ? 'bg-green-500/20 rotate-180' : 'bg-white/[0.06] group-hover:bg-white/[0.1]'
        }`}>
          <ChevronDown className={`w-4 h-4 transition-colors duration-300 ${open ? 'text-green-400' : 'text-white/30'}`} />
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-400 ease-out ${open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pl-16 sm:pl-[4.5rem]">
          <p className="text-sm text-white/50 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── FLOATING ORB ─────────────── */
function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        animation: `float ${6 + delay}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}

/* ═══════════════ PAGE ═══════════════ */
export default function LandingPage() {
  const { user, loading, profile } = useAuthStore()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Scroll-aware sections
  const hero = useReveal(0.1)
  const pain = useReveal()
  const feat = useReveal()
  const how = useReveal()
  const comp = useReveal()
  const test = useReveal()
  const price = useReveal()
  const faq = useReveal()
  const cta = useReveal()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!loading && user && profile) return <Navigate to="/menu" replace />

  const reveal = (visible: boolean, delay = 0) =>
    `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}` +
    (delay ? ` delay-[${delay}ms]` : '')

  return (
    <div className="min-h-screen app-bg text-white overflow-x-hidden">

      {/* ── Animated background mesh ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <FloatingOrb className="w-[600px] h-[600px] -top-48 -left-48 bg-green-500/[0.07] blur-[120px]" delay={0} />
        <FloatingOrb className="w-[500px] h-[500px] top-[20%] -right-32 bg-blue-500/[0.06] blur-[100px]" delay={2} />
        <FloatingOrb className="w-[400px] h-[400px] bottom-[10%] left-[20%] bg-violet-500/[0.05] blur-[100px]" delay={4} />
        <FloatingOrb className="w-[350px] h-[350px] top-[60%] right-[15%] bg-emerald-500/[0.04] blur-[80px]" delay={1} />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </div>

      {/* Float keyframe (injected once) */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-20px) translateX(10px); }
          66% { transform: translateY(10px) translateX(-15px); }
        }
        @keyframes shimmer-slide {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .animate-shimmer-slide {
          background-size: 200% 100%;
          animation: shimmer-slide 3s linear infinite;
        }
      `}</style>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#07142f]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/30'
          : 'bg-transparent border-b border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logo} alt="STOCKIA" className="h-7 sm:h-8 transition-transform group-hover:scale-105" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '#features', label: 'Funciones' },
              { href: '#pricing', label: 'Precio' },
              { href: '#faq', label: 'FAQ' },
            ].map((n) => (
              <a key={n.href} href={n.href}
                className="px-4 py-2 text-sm text-white/40 font-medium rounded-xl hover:text-white hover:bg-white/[0.06] transition-all">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-white/45 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/[0.06]">
              Ingresar
            </Link>
            <Link to="/register"
              className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-4 sm:px-6 gradient-primary text-white text-sm font-bold rounded-xl transition-all hover:brightness-110 shadow-lg shadow-green-900/30 active:scale-[0.97] hover:shadow-xl hover:shadow-green-900/40">
              Probar gratis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all">
              {mobileMenu ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#07142f]/95 backdrop-blur-2xl animate-fade-in">
            <div className="px-6 py-5 space-y-1">
              {['features|Funciones', 'pricing|Precio', 'faq|FAQ'].map((item) => {
                const [id, label] = item.split('|')
                return (
                  <a key={id} href={`#${id}`} onClick={() => setMobileMenu(false)}
                    className="flex items-center gap-3 py-3 px-3 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all font-medium">
                    {label}
                  </a>
                )
              })}
              <Link to="/login" onClick={() => setMobileMenu(false)}
                className="flex items-center gap-3 py-3 px-3 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all font-medium">
                Ingresar
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section ref={hero.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40">
        <div className="max-w-4xl mx-auto text-center">

          {/* Pill badge */}
          <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-xs font-bold uppercase tracking-[0.15em] mb-10 ${
            hero.visible ? 'animate-fade-in' : 'opacity-0'
          } bg-linear-to-r from-green-500/10 to-emerald-500/5 border-green-500/20 text-green-400`}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            7 dias gratis · Sin tarjeta de credito
          </div>

          {/* Headline */}
          <h1 className={`text-[2.5rem] sm:text-6xl lg:text-7xl xl:text-[80px] font-black leading-[1.05] mb-7 tracking-tight ${
            hero.visible ? 'animate-fade-in-up' : 'opacity-0'
          }`}>
            El sistema que tu
            <br />
            negocio{' '}
            <span className="relative inline-block">
              <span className="bg-linear-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
                necesitaba
              </span>
              {/* Decorative underline */}
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 5.5C30 2 70 2 100 4C130 6 170 3 198 5.5" stroke="url(#ug)" strokeWidth="3" strokeLinecap="round"/>
                <defs><linearGradient id="ug" x1="0" y1="0" x2="200" y2="0"><stop stopColor="#22c55e" stopOpacity="0.6"/><stop offset="1" stopColor="#2dd4bf" stopOpacity="0.2"/></linearGradient></defs>
              </svg>
            </span>
          </h1>

          {/* Sub */}
          <p className={`text-lg sm:text-xl lg:text-[22px] text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed ${
            hero.visible ? 'animate-fade-in-up' : 'opacity-0'
          }`} style={{ animationDelay: '100ms' }}>
            Punto de venta, stock, facturación AFIP y reportes de ganancia real.
            <span className="text-white/60 font-medium"> Todo en un solo lugar, listo en minutos.</span>
          </p>

          {/* CTAs */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 ${
            hero.visible ? 'animate-fade-in-up' : 'opacity-0'
          }`} style={{ animationDelay: '200ms' }}>
            <Link to="/register"
              className="group w-full sm:w-auto relative inline-flex items-center justify-center gap-3 h-14 sm:h-[60px] px-10 sm:px-12 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 transition-all hover:brightness-110 hover:shadow-2xl hover:shadow-green-900/50 active:scale-[0.98] text-base sm:text-[17px]">
              Empezar gratis ahora
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              {/* Button glow */}
              <div className="absolute inset-0 rounded-2xl bg-green-400/20 blur-xl -z-10 transition-opacity opacity-0 group-hover:opacity-100" />
            </Link>
            <a href="#features"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-14 sm:h-[60px] px-8 sm:px-10 rounded-2xl text-white/55 font-semibold border border-white/[0.08] hover:border-white/[0.18] hover:text-white hover:bg-white/[0.05] transition-all text-base">
              <Play className="w-4 h-4 transition-transform group-hover:scale-110" />
              Ver cómo funciona
            </a>
          </div>

          {/* Micro-copy */}
          <p className={`text-xs text-white/20 mb-20 font-medium ${hero.visible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
            Sin tarjeta · Sin instalación · Sin compromisos
          </p>

          {/* Stats bar */}
          <div className={`grid grid-cols-3 gap-3 sm:gap-5 max-w-xl mx-auto ${hero.visible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
            {[
              { end: 500, prefix: '+', suffix: '', label: 'Negocios activos', icon: Store },
              { end: 1, prefix: '+', suffix: 'M', label: 'Ventas procesadas', icon: ShoppingCart },
              { end: 99, prefix: '', suffix: '.9%', label: 'Uptime garantizado', icon: Activity },
            ].map((s, i) => (
              <div key={i} className="group relative p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center transition-all hover:bg-white/[0.06] hover:border-white/[0.12] hover:-translate-y-0.5">
                <s.icon className="w-4 h-4 text-green-400/60 mx-auto mb-2" />
                <p className="text-2xl sm:text-3xl font-black text-white mb-1">
                  <Counter end={s.end} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/25 font-semibold uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          PAIN — PROBLEMA
      ══════════════════════════════════════ */}
      <section ref={pain.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${pain.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/15 text-red-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <AlertTriangle className="w-3 h-3" />
            ¿Te identificás?
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">
            ¿Cuánto te cuesta<br className="sm:hidden" /> no tener un sistema?
          </h2>
          <p className="text-white/35 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Cada día sin control es plata que se escapa. Esto le pasa a la mayoría de los negocios.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto">
          {painPoints.map((p, i) => (
            <div key={i} className={`group relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-500 hover:-translate-y-1 ${
              pain.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`} style={{ transitionDelay: `${i * 100 + 200}ms` }}>
              <div className={`w-12 h-12 rounded-2xl bg-linear-to-br ${p.gradient} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <p.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2 leading-snug">{p.title}</h3>
              <p className="text-sm text-white/35 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className={`mt-12 text-center transition-all duration-700 delay-700 ${pain.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-green-500/[0.08] border border-green-500/15">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm sm:text-[15px] font-bold text-white">
              STOCKIA resuelve todo esto desde el primer día.
            </span>
          </div>
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          FEATURES — SOLUCIÓN
      ══════════════════════════════════════ */}
      <section ref={feat.ref} id="features" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${feat.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/15 text-blue-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <Sparkles className="w-3 h-3" />
            Funciones
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">Todo lo que necesitás en un solo lugar</h2>
          <p className="text-white/35 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">Herramientas reales para negocios reales de Argentina</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => (
            <div key={i}
              className={`group relative p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/20 transition-all duration-500 cursor-default ${
                feat.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${i * 80 + 200}ms` }}>
              {/* Hover glow */}
              <div className={`absolute -inset-px rounded-2xl bg-linear-to-b ${f.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 -z-10`} />
              <div className={`w-12 h-12 rounded-2xl bg-linear-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/35 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section ref={how.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <Zap className="w-3 h-3" />
            Así de simple
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">Empezás a vender en 3 pasos</h2>
          <p className="text-white/35 text-base sm:text-lg">No necesitás técnicos, servidores ni instalación</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative max-w-4xl mx-auto">
          {/* Connector line */}
          <div className="hidden md:block absolute top-16 left-[calc(16.5%+2rem)] right-[calc(16.5%+2rem)] h-0.5">
            <div className="h-full bg-linear-to-r from-green-500/20 via-blue-500/20 to-violet-500/20 rounded-full" />
          </div>
          {steps.map((s, i) => (
            <div key={i} className={`text-center relative group transition-all duration-700 ${
              how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`} style={{ transitionDelay: `${i * 150 + 200}ms` }}>
              <div className="relative inline-flex mb-6">
                {/* Pulse ring */}
                <div className={`absolute inset-0 rounded-2xl bg-linear-to-br ${s.gradient} opacity-0 group-hover:opacity-30 transition-opacity duration-500`}
                  style={{ animation: 'pulse-ring 2s ease-out infinite', animationPlayState: 'paused' }}
                />
                <div className={`relative w-20 h-20 rounded-2xl bg-linear-to-br ${s.gradient} flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-105`}>
                  <span className="text-2xl font-black text-white">{s.num}</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{s.title}</h3>
              <p className="text-sm text-white/35 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className={`mt-14 text-center transition-all duration-700 delay-700 ${how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Link to="/register"
            className="group inline-flex items-center gap-2.5 h-13 px-10 gradient-primary text-white font-bold rounded-2xl shadow-lg shadow-green-900/30 hover:brightness-110 hover:shadow-xl transition-all active:scale-[0.98] text-[15px]">
            Crear cuenta gratis <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          COMPARISON
      ══════════════════════════════════════ */}
      <section ref={comp.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${comp.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">¿Por qué STOCKIA?</h2>
          <p className="text-white/35 text-base sm:text-lg">Lo que el cuaderno, el Excel y los sistemas viejos no te dan</p>
        </div>
        <div className={`max-w-2xl mx-auto transition-all duration-700 delay-200 ${comp.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-0 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="p-4 sm:p-5 text-xs font-bold text-white/25 uppercase tracking-wider" />
              <div className="p-4 sm:p-5 text-[10px] sm:text-xs font-bold text-white/25 uppercase tracking-wider text-center w-24 sm:w-28">
                Sin sistema
              </div>
              <div className="p-4 sm:p-5 text-[10px] sm:text-xs font-bold text-green-400 uppercase tracking-wider text-center w-24 sm:w-28 bg-green-500/[0.06] border-l border-green-500/10">
                STOCKIA
              </div>
            </div>
            {comparisons.map((c, i) => (
              <div key={i}
                className={`grid grid-cols-[1fr_auto_auto] gap-0 border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02] ${
                  i % 2 === 0 ? '' : 'bg-white/[0.015]'
                }`}>
                <div className="p-4 sm:p-5 text-sm text-white/50 font-medium">{c.label}</div>
                <div className="p-4 sm:p-5 w-24 sm:w-28 flex justify-center items-center">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <X className="w-3 h-3 text-red-400/60" />
                  </div>
                </div>
                <div className="p-4 sm:p-5 w-24 sm:w-28 flex justify-center items-center bg-green-500/[0.04] border-l border-green-500/8">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section ref={test.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${test.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <Star className="w-3 h-3 fill-amber-400" />
            Testimonios
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">Lo que dicen los que ya lo usan</h2>
          <p className="text-white/35 text-base sm:text-lg">Negocios reales de Argentina</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {testimonials.map((t, i) => (
            <div key={i} className={`group relative p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-5 hover:bg-white/[0.06] hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-500 ${
              test.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`} style={{ transitionDelay: `${i * 120 + 200}ms` }}>
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              {/* Highlight */}
              <p className="text-base font-bold text-white leading-snug">"{t.highlight}"</p>
              {/* Review */}
              <p className="text-sm text-white/40 leading-relaxed flex-1">{t.text}</p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500/30 to-blue-500/30 flex items-center justify-center text-sm font-bold text-white border border-white/[0.08] shadow-inner">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] text-white/30 flex items-center gap-1.5">
                    <Store className="w-3 h-3" /> {t.biz} · {t.city}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          PRICING
      ══════════════════════════════════════ */}
      <section ref={price.ref} id="pricing" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${price.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/15 text-green-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <CreditCard className="w-3 h-3" />
            Precio
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">Un plan, todo incluido</h2>
          <p className="text-white/35 text-base sm:text-lg">Sin funciones bloqueadas, sin sorpresas al final del mes</p>
        </div>

        <div className={`max-w-md mx-auto transition-all duration-700 delay-200 ${price.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Card */}
          <div className="relative rounded-3xl p-8 sm:p-10 border border-green-500/15 bg-white/[0.03] overflow-hidden">
            {/* Multi-layer glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-green-500/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-emerald-500/6 rounded-full blur-[80px] pointer-events-none" />

            {/* Top badge */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-5 py-1.5 gradient-primary text-white text-[11px] font-bold rounded-b-xl shadow-lg shadow-green-900/30">
                <Zap className="w-3 h-3" /> MAS POPULAR
              </span>
            </div>

            {/* Plan name */}
            <p className="text-xs font-bold text-green-400 uppercase tracking-[0.2em] text-center mb-6 mt-4">Plan Negocio</p>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-start justify-center gap-1.5">
                <span className="text-2xl font-bold text-white/50 mt-3">$</span>
                <span className="text-7xl font-black text-white tracking-tight">50.000</span>
              </div>
              <p className="text-sm text-white/30 mt-1.5 font-medium">por mes · en pesos argentinos</p>
              <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/15">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                <p className="text-xs text-green-400 font-semibold">7 días gratis para empezar</p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {planFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    f.hot ? 'bg-green-500/25' : 'bg-white/[0.06]'
                  }`}>
                    <Check className={`w-3 h-3 ${f.hot ? 'text-green-400' : 'text-white/40'}`} />
                  </div>
                  <span className={`text-sm leading-snug ${f.hot ? 'text-white font-semibold' : 'text-white/55'}`}>
                    {f.text}
                    {f.hot && <span className="ml-2 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/15">INCLUIDO</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link to="/register"
              className="group w-full inline-flex items-center justify-center gap-2.5 h-14 py-3.5 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 hover:brightness-110 hover:shadow-2xl transition-all active:scale-[0.99] text-base">
              Empezar 7 días gratis <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="text-center text-[11px] text-white/20 mt-3 flex items-center justify-center gap-2 font-medium">
              <Lock className="w-3 h-3" /> Sin tarjeta · Cancelá cuando quieras
            </p>

            {/* Payment info */}
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <p className="text-[11px] text-white/25 text-center mb-2.5 font-medium">Para suscribirse transferir al alias:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-sm font-black text-white bg-white/[0.06] border border-white/[0.1] px-4 py-2 rounded-xl tracking-wide">farmani2.ppay</span>
                <button
                  onClick={() => { navigator.clipboard.writeText('farmani2.ppay') }}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white transition-all"
                  title="Copiar alias"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Shield, label: 'Datos seguros' },
              { icon: Wifi, label: 'Modo offline' },
              { icon: CreditCard, label: 'Sin tarjeta' },
            ].map((b, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col items-center gap-2 hover:bg-white/[0.05] transition-all">
                <b.icon className="w-4 h-4 text-green-400/70" />
                <span className="text-[11px] text-white/35 font-semibold">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gradient divider ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-8">
        <div className="h-px bg-linear-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section ref={faq.ref} id="faq" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className={`text-center mb-14 sm:mb-16 transition-all duration-700 ${faq.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/50 text-xs font-bold uppercase tracking-[0.15em] mb-5">
            <Globe className="w-3 h-3" />
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">Preguntas frecuentes</h2>
          <p className="text-white/35 text-base sm:text-lg">Respondemos las dudas más comunes antes de arrancar</p>
        </div>
        <div className={`max-w-2xl mx-auto space-y-3 transition-all duration-700 delay-200 ${faq.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} idx={i} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <section ref={cta.ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
        <div className={`relative rounded-3xl p-10 sm:p-16 lg:p-20 text-center overflow-hidden transition-all duration-700 ${
          cta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          {/* Background layers */}
          <div className="absolute inset-0 bg-linear-to-br from-green-500/[0.08] via-transparent to-blue-500/[0.05] rounded-3xl" />
          <div className="absolute inset-0 border border-green-500/10 rounded-3xl" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-green-500/8 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-green-500/10 border border-green-500/15 text-green-400 text-xs font-bold uppercase tracking-[0.15em] mb-8">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              Sin riesgos · Gratis por 7 días
            </div>
            <h2 className="text-3xl sm:text-[42px] lg:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
              Tu negocio merece un sistema<br className="hidden sm:block" />
              <span className="bg-linear-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent"> que funcione de verdad.</span>
            </h2>
            <p className="text-white/35 mb-12 max-w-lg mx-auto text-base sm:text-lg leading-relaxed">
              Empezá hoy. Sin tarjeta, sin técnicos, sin complicaciones.
              <span className="text-white/50 font-medium"> En 15 minutos ya estás vendiendo con STOCKIA.</span>
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 h-14 sm:h-[60px] px-12 sm:px-14 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 hover:brightness-110 hover:shadow-2xl transition-all active:scale-[0.98] text-base sm:text-[17px]">
                Crear cuenta gratis <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center h-14 sm:h-[60px] px-10 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/60 font-semibold hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15] transition-all text-[15px]">
                Ya tengo cuenta
              </Link>
            </div>
            <p className="mt-6 text-[12px] text-white/20 flex items-center justify-center gap-2 font-medium">
              <Lock className="w-3 h-3" />
              Tus datos nunca se comparten con terceros
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={logoSolo} alt="STOCKIA" className="w-7 h-7" />
            <span className="text-sm font-bold text-white/50">STOCKIA</span>
          </div>
          <nav className="flex items-center gap-6 text-xs text-white/20 font-medium">
            <a href="#features" className="hover:text-white/50 transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-white/50 transition-colors">Precio</a>
            <a href="#faq" className="hover:text-white/50 transition-colors">FAQ</a>
            <Link to="/login" className="hover:text-white/50 transition-colors">Ingresar</Link>
          </nav>
          <div className="flex flex-col items-center sm:items-end gap-3">
            <div className="flex items-center gap-3">
              <a href="https://portfoliofrandev.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/25 hover:text-white/60 transition-all" title="Portfolio">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                </svg>
              </a>
              <a href="https://github.com/franarmani" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/25 hover:text-white/60 transition-all" title="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/franarmanidev/" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/25 hover:text-white/60 transition-all" title="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <p className="text-[10px] text-white/15 flex items-center gap-1.5">
              Desarrollado por{' '}
              <a href="https://portfoliofrandev.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white/45 transition-colors underline underline-offset-2">
                Fran Armani
              </a>
              {' '}· {new Date().getFullYear()}
              <ArgentinaFlag className="w-4 h-3 inline-block" />
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}

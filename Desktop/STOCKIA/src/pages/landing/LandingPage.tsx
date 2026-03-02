import { Link, Navigate } from 'react-router-dom'
import logoSolo from '@/logosolo.png'
import logo from '@/logo.png'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  ShoppingCart, BarChart3, Package, Users,
  Shield, ArrowRight, Check, Smartphone,
  FileText, Wallet, Zap, Activity, Bell,
  X, ChevronDown, Star, Clock, TrendingUp,
  CreditCard, Lock, Wifi, AlertTriangle,
  CheckCircle2, Play, Store,
} from 'lucide-react'

/* ─────────────── DATA ─────────────── */

const painPoints = [
  {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    title: 'Perdés ventas por no saber qué tenés en stock',
    desc: 'Decís que sí y después no encontrás el producto. O lo vendés dos veces.',
  },
  {
    icon: Clock,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    title: 'Hacés las facturas a mano o en papel',
    desc: 'Tardás, errás y después tenés problemas con AFIP que te cuestan caro.',
  },
  {
    icon: TrendingUp,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    title: 'No sabés si tu negocio gana o pierde',
    desc: 'Cerrás el mes y no tenés idea cuánto ganaste realmente después de gastos.',
  },
  {
    icon: Users,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    title: 'Los clientes te deben y no podés llevar el control',
    desc: 'Cuadernos, Excel o memoria. Siempre se escapa algo y los números no cierran.',
  },
]

const features = [
  { icon: ShoppingCart, color: 'bg-blue-500/20 text-blue-400', title: 'Punto de venta', desc: 'Vendé rápido con búsqueda inteligente y lector de código de barras. Cada venta en segundos.' },
  { icon: Package, color: 'bg-violet-500/20 text-violet-400', title: 'Control de stock', desc: 'Inventario en tiempo real con alertas de mínimos y gestión de compras a proveedores.' },
  { icon: FileText, color: 'bg-indigo-500/20 text-indigo-400', title: 'Facturación AFIP', desc: 'Factura A, B y C con CAE automático. Notas de crédito incluidas. 100% legal.' },
  { icon: BarChart3, color: 'bg-orange-500/20 text-orange-400', title: 'Reportes y ganancias', desc: 'Ventas, ganancia por producto y métricas del negocio con gráficos claros y exportables.' },
  { icon: Users, color: 'bg-cyan-500/20 text-cyan-400', title: 'Clientes y cta. cte.', desc: 'Registrá clientes, historial completo de compras, saldo de cuenta corriente y deudas.' },
  { icon: Smartphone, color: 'bg-green-500/20 text-green-400', title: 'Modo offline (PWA)', desc: 'Instalable en celular y PC. Si se corta internet seguís vendiendo con tickets — las ventas se sincronizan al volver la conexión.' },
  { icon: Wallet, color: 'bg-rose-500/20 text-rose-400', title: 'Caja diaria', desc: 'Apertura y cierre de caja con arqueo automático. Resumen del día al instante.' },
  { icon: Activity, color: 'bg-emerald-500/20 text-emerald-400', title: 'Salud del negocio', desc: 'Score en tiempo real: stock crítico, deudas, facturas pendientes y alertas inteligentes.' },
  { icon: Bell, color: 'bg-purple-500/20 text-purple-400', title: 'Notificaciones', desc: 'Alertas automáticas de stock bajo, deudas altas, productos sin costo y más.' },
]

const steps = [
  {
    num: '01',
    title: 'Creá tu cuenta',
    desc: 'Registrate en 2 minutos. Sin tarjeta, sin letra chica. 7 días para probarlo todo.',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
  },
  {
    num: '02',
    title: 'Cargá tus productos',
    desc: 'Importá desde Excel o cargalos uno a uno. Stock, precios y categorías en orden.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
  },
  {
    num: '03',
    title: 'Empezá a vender',
    desc: 'Punto de venta listo, facturación automática y reportes en tiempo real desde el día uno.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10 border-violet-400/20',
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

/* ─────────────── FAQ ITEM ─────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      className="w-full text-left glass-card p-5 hover:bg-white/8 transition-all duration-200"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-white leading-snug">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180 text-green-400' : ''}`}
        />
      </div>
      {open && (
        <p className="text-sm text-white/55 leading-relaxed mt-3 border-t border-white/8 pt-3">
          {a}
        </p>
      )}
    </button>
  )
}

/* ─────────────── COMPARISON ROW ─────────────── */
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

/* ═══════════════ PAGE ═══════════════ */
export default function LandingPage() {
  const { user, loading, profile } = useAuthStore()

  // Already logged in with profile → go to app
  if (!loading && user && profile) return <Navigate to="/menu" replace />

  return (
    <div className="min-h-screen app-bg text-white overflow-x-hidden">

      {/* ── Background blobs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-175 h-175 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-150 h-150 bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-100 h-100 bg-violet-500/8 rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-0 w-87.5 h-87.5 bg-rose-500/5 rounded-full blur-3xl" />
      </div>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="STOCKIA" className="h-7" />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precio</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm font-medium text-white/55 hover:text-white transition-colors px-3 py-1.5">
              Ingresar
            </Link>
            <Link to="/register"
              className="inline-flex items-center gap-1.5 h-8 px-4 gradient-primary text-white text-sm font-semibold rounded-xl transition-all hover:brightness-110 shadow-lg shadow-green-900/40">
              Probar gratis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════
          HERO — ATENCIÓN
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold uppercase tracking-widest mb-7 animate-fade-in">
            <Zap className="w-3 h-3" />
            7 días gratis · Sin tarjeta de crédito
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-bold leading-[1.08] mb-5 tracking-tight animate-fade-in-up">
            El sistema que tu negocio<br />
            <span className="bg-linear-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
              necesitaba desde siempre
            </span>
          </h1>

          {/* Sub */}
          <p className="text-base sm:text-xl text-white/50 mb-10 max-w-xl mx-auto leading-relaxed animate-fade-in-up">
            Punto de venta, stock, facturación AFIP y reportes de ganancia real.
            Todo en un solo lugar, listo en minutos.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 animate-fade-in-up">
            <Link to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-14 px-10 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 transition-all hover:brightness-110 active:scale-[0.98] text-[16px]">
              Empezar gratis ahora <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-14 px-8 glass-card text-white/75 font-medium rounded-2xl hover:bg-white/10 transition-colors text-[15px]">
              <Play className="w-4 h-4" />
              Ver cómo funciona
            </a>
          </div>

          {/* Micro-copy */}
          <p className="text-xs text-white/30 mb-14">
            Sin tarjeta · Sin instalación · Sin compromisos
          </p>

          {/* Social proof numbers */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {[
              { val: '+500', label: 'Negocios activos' },
              { val: '+1M', label: 'Ventas procesadas' },
              { val: '99.9%', label: 'Uptime garantizado' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-3.5 text-center">
                <p className="text-xl font-bold text-green-400">{s.val}</p>
                <p className="text-[11px] text-white/35 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          PAIN — PROBLEMA
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-widest mb-4">
            ¿Te identificás?
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            ¿Cuánto te cuesta no tener un sistema?
          </h2>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            Cada día sin control es plata que se escapa. Esto le pasa a la mayoría de los negocios sin sistema.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {painPoints.map((p, i) => (
            <div key={i} className="glass-card p-5 flex gap-4 items-start">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.bg}`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">{p.title}</h3>
                <p className="text-[13px] text-white/45 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Bridge */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-sm font-semibold text-white">
              STOCKIA resuelve todo esto desde el primer día.
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES — SOLUCIÓN
      ══════════════════════════════════════ */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Funciones
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Todo lo que necesitás en un solo lugar</h2>
          <p className="text-white/40 text-sm">Herramientas reales para negocios reales de Argentina</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div key={i}
              className="glass-card p-5 hover:bg-white/10 hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 cursor-default">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-[13px] text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS — INTERÉS
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Así de simple
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Empezás a vender en 3 pasos</h2>
          <p className="text-white/40 text-sm">No necesitás técnicos, servidores ni instalación</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line desktop */}
          <div className="hidden md:block absolute top-13 left-[calc(16.5%+1rem)] right-[calc(16.5%+1rem)] h-px bg-linear-to-r from-green-500/30 via-blue-500/30 to-violet-500/30" />
          {steps.map((s, i) => (
            <div key={i} className="text-center relative">
              <div className={`inline-flex w-17 h-17 rounded-2xl border items-center justify-center mb-4 ${s.bg}`}>
                <span className={`text-2xl font-black ${s.color}`}>{s.num}</span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/register"
            className="inline-flex items-center gap-2 h-12 px-8 gradient-primary text-white font-bold rounded-2xl shadow-lg shadow-green-900/30 hover:brightness-110 transition-all active:scale-[0.98] text-[15px]">
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════
          COMPARISON
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">¿Por qué STOCKIA?</h2>
          <p className="text-white/40 text-sm">Lo que el cuaderno, el Excel y los sistemas viejos no te dan</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="glass-card overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-0 border-b border-white/10">
              <div className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider"></div>
              <div className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-center w-28">
                Sin sistema
              </div>
              <div className="p-4 text-xs font-semibold text-green-400 uppercase tracking-wider text-center w-28 bg-green-500/5 border-l border-green-500/20">
                STOCKIA
              </div>
            </div>
            {/* Rows */}
            {comparisons.map((c, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_auto] gap-0 border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/2'}`}
              >
                <div className="p-4 text-sm text-white/70">{c.label}</div>
                <div className="p-4 w-28 flex justify-center items-center">
                  <X className="w-4 h-4 text-red-400/70" />
                </div>
                <div className="p-4 w-28 flex justify-center items-center bg-green-500/5 border-l border-green-500/10">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS — DESEO
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Testimonios
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Lo que dicen los que ya lo usan</h2>
          <p className="text-white/40 text-sm">Negocios reales de Argentina</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <div key={i} className="glass-card p-6 flex flex-col gap-4">
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              {/* Highlight quote */}
              <p className="text-sm font-bold text-green-400">"{t.highlight}"</p>
              {/* Full review */}
              <p className="text-sm text-white/50 leading-relaxed flex-1">{t.text}</p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/8">
                <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-500/40 to-blue-500/40 flex items-center justify-center text-sm font-bold text-white">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] text-white/35 flex items-center gap-1">
                    <Store className="w-3 h-3" /> {t.biz} · {t.city}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          PRICING — ACCIÓN
      ══════════════════════════════════════ */}
      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Precio
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Un plan, todo incluido</h2>
          <p className="text-white/40 text-sm">Sin funciones bloqueadas, sin sorpresas al final del mes</p>
        </div>

        <div className="max-w-md mx-auto">
          {/* Card */}
          <div className="relative glass-card p-8 border border-green-500/25 bg-green-500/5 overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Badge */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1 gradient-primary text-white text-[11px] font-bold rounded-b-xl shadow-lg">
                <Zap className="w-3 h-3" /> MÁS POPULAR
              </span>
            </div>

            {/* Plan name */}
            <p className="text-xs font-bold text-green-400 uppercase tracking-widest text-center mb-5 mt-3">Plan Negocio</p>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="flex items-start justify-center gap-1">
                <span className="text-2xl font-bold text-white/60 mt-2">$</span>
                <span className="text-6xl font-black text-white tracking-tight">50.000</span>
              </div>
              <p className="text-sm text-white/35 mt-1">por mes · en pesos argentinos</p>
              <p className="text-xs text-green-400 mt-1.5 font-semibold">7 días gratis para empezar</p>
            </div>

            {/* Features list */}
            <div className="space-y-2.5 mb-7">
              {planFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className={`text-sm ${f.hot ? 'text-white font-medium' : 'text-white/65'}`}>
                    {f.text}
                    {f.hot && <span className="ml-1.5 text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">INCLUIDO</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link to="/register"
              className="w-full inline-flex items-center justify-center gap-2 h-13 py-3.5 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 hover:brightness-110 transition-all active:scale-[0.99] text-[15px]">
              Empezar 7 días gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-center text-[11px] text-white/25 mt-3 flex items-center justify-center gap-2">
              <Lock className="w-3 h-3" /> Sin tarjeta · Cancelá cuando quieras
            </p>

            {/* Payment info */}
            <div className="mt-4 pt-4 border-t border-white/8">
              <p className="text-[11px] text-white/30 text-center mb-2">Para suscribirse transferir al alias:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-sm font-black text-white bg-white/8 border border-white/15 px-3 py-1.5 rounded-lg tracking-wide">farmani2.ppay</span>
                <button
                  onClick={() => { navigator.clipboard.writeText('farmani2.ppay'); }}
                  className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                  title="Copiar alias"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Shield, label: 'Datos seguros' },
              { icon: Wifi, label: 'Modo offline' },
              { icon: CreditCard, label: 'Sin tarjeta' },
            ].map((b, i) => (
              <div key={i} className="glass-card p-3 flex flex-col items-center gap-1.5">
                <b.icon className="w-4 h-4 text-green-400" />
                <span className="text-[11px] text-white/45 font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section id="faq" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Preguntas frecuentes</h2>
          <p className="text-white/40 text-sm">Respondemos las dudas más comunes antes de arrancar</p>
        </div>
        <div className="max-w-2xl mx-auto space-y-2">
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA — ACCIÓN FINAL
      ══════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="relative glass-card p-10 sm:p-14 text-center overflow-hidden border border-green-500/20 bg-linear-to-br from-green-500/5 via-transparent to-blue-500/5">
          {/* Background glow */}
          <div className="absolute inset-0 bg-linear-to-b from-green-500/5 to-transparent pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" />
              Sin riesgos · Gratis por 7 días
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              Tu negocio merece un sistema<br className="hidden sm:block" />
              <span className="bg-linear-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent"> que funcione de verdad.</span>
            </h2>
            <p className="text-white/45 mb-10 max-w-md mx-auto text-base leading-relaxed">
              Empezá hoy. Sin tarjeta, sin técnicos, sin complicaciones. En 15 minutos ya estás vendiendo con STOCKIA.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-14 px-12 gradient-primary text-white font-bold rounded-2xl shadow-xl shadow-green-900/40 hover:brightness-110 transition-all active:scale-[0.98] text-[16px]">
                Crear cuenta gratis <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 glass-card text-white/70 font-medium rounded-2xl hover:bg-white/10 transition-colors text-[15px]">
                Ya tengo cuenta
              </Link>
            </div>
            <p className="mt-5 text-[12px] text-white/25 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Tus datos nunca se comparten con terceros
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/8 mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <img src={logoSolo} alt="STOCKIA" className="w-7 h-7" />
            <span className="text-sm font-bold text-white/60">STOCKIA</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-white/25">
            <a href="#features" className="hover:text-white/50 transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-white/50 transition-colors">Precio</a>
            <a href="#faq" className="hover:text-white/50 transition-colors">FAQ</a>
            <Link to="/login" className="hover:text-white/50 transition-colors">Ingresar</Link>
          </nav>
          <div className="flex flex-col items-center sm:items-end gap-2">
            <div className="flex items-center gap-3">
              {/* Portfolio */}
              <a href="https://portfoliofrandev.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white/60 transition-colors" title="Portfolio">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                </svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/franarmani" target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white/60 transition-colors" title="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="https://www.linkedin.com/in/franarmanidev/" target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white/60 transition-colors" title="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <p className="text-[10px] text-white/15">
              Desarrollado por{' '}
              <a href="https://portfoliofrandev.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="text-white/30 hover:text-white/50 transition-colors underline underline-offset-2">
                Fran Armani
              </a>
              {' '}· {new Date().getFullYear()} 🇦🇷
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}

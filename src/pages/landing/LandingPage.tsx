import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  Gauge,
  Clock3,
  Menu,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCcw,
  ScanBarcode,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
  WifiOff,
  X,
} from 'lucide-react'
import { SUPPORT_WHATSAPP_URL } from '@/config/publicUrls'
import CajaGoBrand, { CajaGoIcon } from '@/components/brand/CajaGoBrand'
import { useAuthStore } from '@/stores/authStore'
import { PLANS, formatPlanPrice, type PlanId } from '@/config/plans'

const TRIAL_DAYS = 5

const industries = [
  'Corralones',
  'Ferreterías',
  'Almacenes',
  'Dietéticas',
  'Librerías',
  'Pet shops',
  'Indumentaria',
  'Repuestos',
  'Vinotecas',
  'Bazar',
]

const painPoints = [
  ['La caja nunca cierra igual', 'Sumás tickets, transferencias y tarjetas cuando ya deberías estar cerrando el local.'],
  ['El stock vive atrasado', 'Vendés, reponés y ajustás en lugares distintos. El número rara vez coincide con la estantería.'],
  ['No sabés el margen real', 'Tenés ventas, pero no una lectura clara de costos, rentabilidad y productos que inmovilizan dinero.'],
  ['Cada tarea usa otra herramienta', 'Planillas, cuadernos, WhatsApp y sistemas separados convierten una consulta simple en media hora.'],
]

const operatingFlow = [
  {
    icon: ScanBarcode,
    title: 'Una venta tarda segundos',
    copy: 'Escaneás, elegís cómo cobra el cliente y confirmás. CajaGo registra el movimiento sin obligarte a navegar por formularios.',
    detail: 'Código de barras · Pago mixto · Cuenta corriente · Atajos',
  },
  {
    icon: PackageCheck,
    title: 'El stock se mueve con el negocio',
    copy: 'Cada venta descuenta existencias. Cada compra actualiza stock y costos. Las alertas aparecen antes de que falte mercadería.',
    detail: 'Unidades, kilos, metros y litros · Costos promedio · Alertas',
  },
  {
    icon: ReceiptText,
    title: 'Caja, ARCA y reportes quedan conectados',
    copy: 'El comprobante, el medio de pago y el impacto en caja nacen de la misma operación. Menos carga duplicada, menos errores.',
    detail: 'Factura A, B y C · CAE · Arqueo · Rentabilidad',
  },
]

const featurePanels = [
  {
    id: 'venta',
    icon: ShoppingCart,
    title: 'Vendé',
    subtitle: 'Un mostrador que no frena la fila.',
    points: ['Lector USB o cámara', 'Efectivo, tarjetas, transferencia y pago mixto', 'Descuentos, cuotas y cuenta corriente', 'Ticket o factura electrónica'],
  },
  {
    id: 'control',
    icon: Gauge,
    title: 'Controlá',
    subtitle: 'Stock y caja con números confiables.',
    points: ['Stock mínimo y movimientos', 'Apertura, cierre y arqueo', 'Costos y valorización', 'Usuarios con permisos'],
  },
  {
    id: 'administra',
    icon: FileCheck2,
    title: 'Administrá',
    subtitle: 'Compras, clientes y proveedores conectados.',
    points: ['Comprobantes de compra', 'Pagos a proveedores', 'Presupuestos y clientes', 'Libro IVA y cuentas corrientes'],
  },
  {
    id: 'decidi',
    icon: TrendingUp,
    title: 'Decidí',
    subtitle: 'Información para comprar y vender mejor.',
    points: ['Margen por producto y categoría', 'Ventas por período y vendedor', 'Productos sin movimiento', 'Libro diario y mayor'],
  },
]

const faqs = [
  {
    question: '¿CajaGo es una aplicación para Windows?',
    answer: 'Sí. CajaGo se instala en Windows y abre como cualquier programa de escritorio. La web comercial se usa para conocer el producto y crear la cuenta.',
  },
  {
    question: '¿Qué pasa si se corta internet?',
    answer: 'Si el equipo ya fue autenticado, podés seguir haciendo ventas con ticket y consultar el catálogo local. Las operaciones pendientes se sincronizan al recuperar conexión. La autorización fiscal de ARCA necesita internet.',
  },
  {
    question: '¿Puedo cargar mis productos desde Excel?',
    answer: 'Sí. Podés importar el catálogo, revisar los datos antes de confirmarlos y después exportarlo cuando lo necesites.',
  },
  {
    question: '¿Sirve para más de una caja?',
    answer: 'Sí. Podés trabajar con varias computadoras y usuarios. Cuando tienen conexión, comparten los datos del mismo negocio con permisos separados.',
  },
  {
    question: `¿Qué incluye la prueba de ${TRIAL_DAYS} días?`,
    answer: `Acceso al sistema para probarlo con la operación real del negocio, sin tarjeta. Podés cargar productos, vender, controlar caja, revisar stock y evaluar los módulos de gestión.`,
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer: 'Sí. Los planes son mensuales y no tienen permanencia. Antes de cualquier renovación vas a tener visible el estado de tu suscripción.',
  },
]

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 34 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Eyebrow({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <p className={`mb-5 flex items-center gap-3 text-sm font-semibold text-[#9aa9ff] ${centered ? 'justify-center' : ''}`}>
      <span className="h-px w-8 bg-[#8295ff]" />
      {children}
    </p>
  )
}

function AppPreview() {
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const previewY = useTransform(scrollYProgress, [0, 0.32], [0, reducedMotion ? 0 : 45])

  const products = [
    ['ABRAZADERA AC/INOX 10-16MM', '45 uds', '$ 807,00'],
    ['CEMENTO PORTLAND 50KG', '32 uds', '$ 19.800,00'],
    ['ARENA FINA · BOLSA', '18 uds', '$ 14.400,00'],
    ['HIDRÓFUGO 10KG', '11 uds', '$ 8.750,00'],
  ]

  const cart = [
    ['Cemento Portland 50kg', '2 × $ 19.800', '$ 39.600'],
    ['Arena fina · bolsa', '1 × $ 14.400', '$ 14.400'],
    ['Hidrófugo 10kg', '1 × $ 8.750', '$ 8.750'],
  ]

  return (
    <motion.div style={{ y: previewY }} className="relative mx-auto w-full max-w-[72rem]">
      <div className="absolute inset-x-[12%] -bottom-12 h-32 rounded-full bg-[#6175e8]/20 blur-[70px]" />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 28, scale: 0.97 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.13] bg-[#0e141e] shadow-[0_45px_110px_rgba(0,0,0,0.48)]"
      >
        <div className="flex h-14 items-center justify-between border-b border-white/[0.08] bg-[#111925] px-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]"><CajaGoIcon size="sm" /></div>
            <div className="h-6 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7185f3]/12 text-[#9aa9ff]"><ShoppingCart className="h-3.5 w-3.5" /></div><div><p className="text-[0.63rem] font-bold uppercase tracking-wide text-white">Nueva venta</p><p className="hidden text-[0.46rem] uppercase tracking-widest text-slate-600 sm:block">Casa central</p></div></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3"><div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1.5 text-[0.5rem] font-bold uppercase tracking-wide text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" /><span className="hidden sm:inline">Caja abierta</span></div><div className="hidden items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[0.52rem] font-semibold text-slate-400 md:flex"><User className="h-3 w-3" /> Bruno</div></div>
        </div>

        <div className="grid min-h-[30rem] grid-cols-[minmax(0,1fr)_40%] bg-[#0a111c] sm:grid-cols-[minmax(0,1fr)_35%]">
          <div className="min-w-0 border-r border-white/[0.07]">
            <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] p-2.5 sm:p-3">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d1b2d] px-3 text-[0.55rem] text-slate-500"><Search className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Buscar por nombre, código o marca...</span><span className="ml-auto hidden rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.45rem] text-slate-600 sm:inline">F2</span></div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0d1b2d] text-slate-500"><ScanBarcode className="h-3.5 w-3.5" /></div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#8295ff]" /><p className="text-[0.62rem] font-bold text-white sm:text-[0.72rem]">Venta rápida</p><span className="hidden text-[0.5rem] text-slate-600 sm:inline">Productos disponibles</span></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {products.map(([name, stock, price], index) => (
                  <div key={name} className={`group flex min-h-[6.6rem] flex-col rounded-xl border p-2.5 sm:min-h-[7.4rem] sm:p-3 ${index === 0 ? 'border-[#8295ff]/30 bg-[#15243a]' : 'border-white/[0.07] bg-[#122238]'}`}>
                    <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-[0.56rem] font-semibold leading-4 text-white sm:text-[0.65rem]">{name}</p><span className="hidden shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.43rem] font-semibold text-slate-500 sm:inline">{stock}</span></div>
                    <div className="mt-auto flex items-end justify-between"><p className="font-mono text-[0.66rem] font-bold text-white sm:text-[0.82rem]">{price}</p><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#7185f3]/12 text-[#9aa9ff]"><Plus className="h-3 w-3" /></span></div>
                  </div>
                ))}
              </div>
              <div className="mt-3 hidden grid-cols-3 gap-2 md:grid"><div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5"><p className="text-[0.45rem] uppercase tracking-wide text-slate-600">Atajo</p><p className="mt-1 text-[0.55rem] font-semibold text-slate-400">F4 · Cliente</p></div><div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5"><p className="text-[0.45rem] uppercase tracking-wide text-slate-600">Comprobante</p><p className="mt-1 text-[0.55rem] font-semibold text-slate-400">Ticket</p></div><div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5"><p className="text-[0.45rem] uppercase tracking-wide text-slate-600">Estado</p><p className="mt-1 text-[0.55rem] font-semibold text-emerald-300">En línea</p></div></div>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col bg-[#0d1b2d] p-2.5 sm:p-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#8295ff]/20 bg-[#7185f3]/10 text-[#9aa9ff]"><ShoppingCart className="h-3.5 w-3.5" /></span><div><p className="text-[0.58rem] font-bold text-white sm:text-[0.68rem]">Venta actual</p><p className="text-[0.42rem] text-slate-600 sm:text-[0.48rem]">4 ítems</p></div></div><X className="hidden h-3.5 w-3.5 text-slate-600 sm:block" /></div>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] p-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-slate-500"><User className="h-3 w-3" /></span><div className="min-w-0"><p className="text-[0.42rem] uppercase tracking-wide text-slate-600">Cliente</p><p className="truncate text-[0.52rem] font-semibold text-white sm:text-[0.58rem]">Consumidor final</p></div></div>
            <div className="mt-2.5 flex-1 space-y-1.5 overflow-hidden">
              {cart.map(([name, detail, price]) => <div key={name} className="rounded-lg border border-white/[0.07] bg-[#122238] p-2"><div className="flex gap-2"><span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-600 sm:flex"><Package className="h-3 w-3" /></span><div className="min-w-0 flex-1"><p className="truncate text-[0.48rem] font-semibold text-white sm:text-[0.56rem]">{name}</p><div className="mt-1 flex items-center justify-between gap-1"><span className="truncate text-[0.4rem] text-slate-600 sm:text-[0.46rem]">{detail}</span><span className="font-mono text-[0.45rem] font-semibold text-white sm:text-[0.52rem]">{price}</span></div></div></div></div>)}
            </div>
            <div className="mt-2.5"><p className="mb-1.5 hidden text-[0.43rem] font-bold uppercase tracking-wide text-slate-600 sm:block">Método de pago</p><div className="grid grid-cols-2 gap-1.5"><div className="flex items-center justify-center gap-1 rounded-lg border border-[#8295ff]/25 bg-[#7185f3]/10 py-2 text-[0.44rem] font-semibold text-[#aab6ff]"><Banknote className="h-2.5 w-2.5" /> Efectivo</div><div className="flex items-center justify-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.035] py-2 text-[0.44rem] font-semibold text-slate-500"><CreditCard className="h-2.5 w-2.5" /> Débito</div></div></div>
            <div className="mt-2.5 rounded-lg border border-white/[0.07] bg-[#122238] p-2.5"><div className="flex items-end justify-between"><span className="text-[0.52rem] font-bold text-white sm:text-[0.6rem]">Total</span><span className="font-mono text-[0.72rem] font-bold text-white sm:text-[0.92rem]">$ 62.750</span></div></div>
            <div className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#7185f3] text-[0.52rem] font-bold text-white sm:text-[0.6rem]"><ShoppingCart className="h-3 w-3" /> Cobrar <span className="hidden rounded bg-black/20 px-1 py-0.5 font-mono text-[0.4rem] sm:inline">F8</span></div>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/[0.09]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="group flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8295ff]">
        <span className="text-base font-semibold text-white transition-colors group-hover:text-[#aab6ff]">{question}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] transition-all ${open ? 'rotate-180 bg-white text-[#0a0e15]' : 'text-slate-500 group-hover:border-white/25 group-hover:text-white'}`}><ChevronDown className="h-4 w-4" /></span>
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="max-w-2xl pb-6 pr-10 text-sm leading-7 text-slate-400">{answer}</p>
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  const { user, loading, profile } = useAuthStore()
  const reducedMotion = useReducedMotion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState('venta')

  if (!loading && user && profile) return <Navigate to="/menu" replace />

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#090d14] font-['Outfit','Manrope',sans-serif] text-[#f4f6fa] selection:bg-[#8295ff]/30">
      <a href="#contenido" className="sr-only z-[70] rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ir al contenido</a>

      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none fixed -right-40 -top-48 z-0 h-[42rem] w-[42rem] rounded-full bg-[#6175e8]/10 blur-[120px]" />

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-2xl border border-white/[0.1] bg-[#0d121b]/82 px-4 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:px-5">
          <a href="#inicio" aria-label="CajaGo, volver al inicio" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8295ff]"><CajaGoBrand size="sm" /></a>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-400 lg:flex" aria-label="Navegación principal">
            <a href="#resultados" className="transition-colors hover:text-white">Resultados</a>
            <a href="#producto" className="transition-colors hover:text-white">Producto</a>
            <a href="#sin-internet" className="transition-colors hover:text-white">Sin internet</a>
            <a href="#planes" className="transition-colors hover:text-white">Planes</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:text-white sm:block">Ingresar</Link>
            <Link to="/register" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#7185f3] px-4 text-xs font-bold text-white shadow-[0_8px_24px_rgba(82,103,212,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#8295ff] active:translate-y-0">Probar gratis <ArrowRight className="h-3.5 w-3.5" /></Link>
            <button type="button" aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileMenuOpen} aria-controls="landing-mobile-menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] text-white lg:hidden">{mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.nav id="landing-mobile-menu" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-2 grid max-w-[1240px] gap-1 rounded-2xl border border-white/[0.1] bg-[#0d121b]/95 p-3 text-sm font-semibold text-slate-300 shadow-2xl backdrop-blur-2xl lg:hidden">
            {['resultados', 'producto', 'sin-internet', 'planes', 'preguntas'].map((id) => <a key={id} href={`#${id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 capitalize hover:bg-white/[0.05] hover:text-white">{id.replace('-', ' ')}</a>)}
          </motion.nav>
        )}
      </header>

      <main id="contenido" className="relative z-10">
        <section id="inicio" className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8">
          {/* Halo suave detrás del título: da profundidad sin competir con el texto */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-[420px] max-w-3xl rounded-full bg-[radial-gradient(closest-side,rgba(112,135,245,0.22),transparent)] blur-2xl" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <motion.p initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
              Sistema de gestión para comercios argentinos
            </motion.p>

            <motion.h1 initial={reducedMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 text-balance text-[clamp(2.35rem,7.2vw,4.75rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-white">
              Tu negocio avanza.
              <span className="cg-accent block">El control no se queda atrás.</span>
            </motion.h1>

            <motion.p initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.14 }}
              className="mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
              Punto de venta, stock, caja, facturación ARCA, compras y contabilidad en un programa de escritorio que sigue funcionando aunque se corte internet.
            </motion.p>

            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.24 }}
              className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link to="/register" className="group inline-flex h-[3.25rem] items-center justify-center gap-3 rounded-xl bg-white px-7 text-sm font-bold text-[#0a0e15] shadow-[0_12px_40px_rgba(154,169,255,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#eef1ff] active:translate-y-0">
                Probar {TRIAL_DAYS} días gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#producto" className="inline-flex h-[3.25rem] items-center justify-center rounded-xl border border-white/[0.13] bg-white/[0.035] px-7 text-sm font-semibold text-white transition-all hover:border-white/25 hover:bg-white/[0.07]">
                Ver cómo funciona
              </a>
            </motion.div>

            <motion.ul initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.34 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
              {['Sin tarjeta', 'Sin comisión por venta', 'Funciona sin internet', 'Soporte humano'].map((item) => (
                <li key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400/80" /> {item}</li>
              ))}
            </motion.ul>
          </div>

          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-14 sm:mt-16">
            <div aria-hidden className="pointer-events-none absolute -inset-x-6 -top-10 bottom-1/2 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(112,135,245,0.18),transparent)]" />
            <div className="relative"><AppPreview /></div>
          </motion.div>
        </section>

        <section className="border-y border-white/[0.08] bg-white/[0.018]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-2 divide-x divide-y divide-white/[0.08] px-4 sm:grid-cols-4 sm:divide-y-0 sm:px-6 lg:px-8">
            {[
              ['0%', 'comisión por venta'],
              [`${TRIAL_DAYS} días`, 'para probarlo sin tarjeta'],
              ['A, B y C', 'facturación electrónica'],
              ['Windows', 'aplicación de escritorio'],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-7 text-center sm:px-6"><p className="font-mono text-xl font-semibold text-white sm:text-2xl">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{label}</p></div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden border-b border-white/[0.08] py-7">
          <div className="landing-marquee flex w-max items-center gap-10 whitespace-nowrap pr-10 text-sm font-semibold text-slate-600">
            {[...industries, ...industries].map((industry, index) => <span key={`${industry}-${index}`} className="flex items-center gap-10"><span>{industry}</span><span className="h-1 w-1 rounded-full bg-[#7185f3]" /></span>)}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6 sm:py-40 lg:px-8">
          <Reveal className="max-w-4xl"><Eyebrow>El problema no es cuánto trabajás</Eyebrow><h2 className="text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">Tu negocio no debería depender de tu memoria.</h2></Reveal>
          <div className="mt-16 border-t border-white/[0.1]">
            {painPoints.map(([title, copy], index) => (
              <Reveal key={title} delay={index * 0.04}>
                <article className="group grid gap-4 border-b border-white/[0.1] py-7 transition-colors hover:bg-white/[0.018] sm:grid-cols-[4rem_0.9fr_1.1fr] sm:items-start sm:px-4 sm:py-9">
                  <span className="font-mono text-xs text-[#8295ff]">0{index + 1}</span><h3 className="text-xl font-semibold text-white sm:text-2xl">{title}</h3><p className="max-w-xl text-sm leading-7 text-slate-500 transition-colors group-hover:text-slate-400">{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="resultados" className="border-y border-white/[0.08] bg-[#0c1119]">
          <div className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6 sm:py-40 lg:px-8">
            <Reveal className="max-w-3xl"><Eyebrow>Lo que cambia desde el primer día</Eyebrow><h2 className="text-balance text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-6xl">Menos tareas sueltas. Más control para decidir.</h2></Reveal>

            <div className="mt-16 grid grid-flow-dense gap-3 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <article className="group relative min-h-[25rem] overflow-hidden rounded-[1.6rem] bg-[#151d29] p-7 sm:p-9">
                  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#7185f3]/14 blur-3xl transition-transform duration-700 group-hover:scale-125" />
                  <div className="relative"><p className="text-sm font-semibold text-[#aab6ff]">Resultado diario</p><h3 className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">Sabés qué vendiste, cuánto cobraste y qué falta reponer.</h3></div>
                  <div className="absolute inset-x-7 bottom-7 grid grid-cols-3 gap-2 sm:inset-x-9 sm:bottom-9">
                    {[['Ventas hoy', '$ 384.520'], ['Margen', '36,8%'], ['Stock crítico', '12']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.08] bg-[#0d131c]/80 p-3.5 backdrop-blur"><p className="text-[0.58rem] text-slate-500">{label}</p><p className="mt-2 font-mono text-sm font-semibold text-white sm:text-lg">{value}</p></div>)}
                  </div>
                </article>
              </Reveal>
              <Reveal className="lg:col-span-5" delay={0.08}>
                <article className="flex min-h-[25rem] flex-col rounded-[1.6rem] bg-[#eef0f8] p-7 text-[#101521] sm:p-9"><CircleDollarSign className="h-7 w-7 text-[#6175e8]" /><h3 className="mt-12 text-3xl font-bold tracking-[-0.04em]">Cerrá la caja en minutos, no de madrugada.</h3><p className="mt-auto max-w-sm text-sm leading-7 text-slate-600">CajaGo separa efectivo, tarjetas, transferencias, ingresos y retiros. El arqueo muestra la diferencia sin cuentas manuales.</p></article>
              </Reveal>
              {[
                [PackageCheck, 'Stock que se actualiza al vender', 'Cada producto baja en la misma operación.'],
                [FileCheck2, 'Facturá sin salir del mostrador', 'Comprobantes A, B y C con CAE.'],
                [BarChart3, 'Rentabilidad que se puede leer', 'Costos, margen y rotación en contexto.'],
              ].map(([Icon, title, copy], index) => (
                <Reveal key={String(title)} className="lg:col-span-4" delay={0.08 + index * 0.05}>
                  <article className="group min-h-[17rem] rounded-[1.4rem] border border-white/[0.08] bg-[#121923] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-[#8295ff]/30"><Icon className="h-6 w-6 text-[#9aa9ff]" /><h3 className="mt-12 text-xl font-bold text-white">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{String(copy)}</p></article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="producto" className="mx-auto grid max-w-[1240px] gap-14 px-4 py-28 sm:px-6 sm:py-40 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
          <div className="lg:sticky lg:top-32 lg:h-fit"><Reveal><Eyebrow>Un sistema, una operación</Eyebrow><h2 className="text-balance text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-6xl">Vos atendés. CajaGo conecta los datos.</h2><p className="mt-6 max-w-md text-base leading-8 text-slate-500">No se trata de sumar pantallas. Se trata de que cada acción deje el negocio actualizado sin volver a cargar lo mismo.</p></Reveal></div>
          <div className="space-y-5">
            {operatingFlow.map(({ icon: Icon, title, copy, detail }, index) => (
              <Reveal key={title} delay={index * 0.06}>
                <article className="group relative min-h-[22rem] overflow-hidden rounded-[1.7rem] border border-white/[0.09] bg-[#111822] p-7 sm:p-10">
                  <div className="absolute right-0 top-0 font-mono text-[8rem] font-bold leading-none text-white/[0.025] sm:text-[11rem]">0{index + 1}</div>
                  <div className="relative flex h-full min-h-[17rem] flex-col"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7185f3]/12 text-[#9aa9ff]"><Icon className="h-5 w-5" /></div><h3 className="mt-9 max-w-xl text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">{title}</h3><p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">{copy}</p><p className="mt-auto border-t border-white/[0.08] pt-5 text-xs font-medium text-slate-600">{detail}</p></div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="sin-internet" className="relative overflow-hidden border-y border-white/[0.08] bg-[#eef0f8] text-[#101521]">
          <div className="absolute right-[-10%] top-[-35%] h-[34rem] w-[34rem] rounded-full bg-[#8295ff]/25 blur-[100px]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-16 px-4 py-28 sm:px-6 sm:py-36 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <Reveal><p className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#5367d3]"><span className="h-px w-8 bg-[#6175e8]" /> CajaGo Desktop</p><h2 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-6xl">Se corta internet. Tu mostrador sigue abierto.</h2><p className="mt-7 max-w-xl text-base leading-8 text-slate-600">El programa guarda el catálogo y las ventas con ticket en la computadora. Cuando vuelve la conexión, sincroniza las operaciones pendientes con la nube.</p><div className="mt-9 flex flex-wrap gap-3">{['Venta con ticket', 'Catálogo local', 'Stock local', 'Reintentos automáticos'].map((item) => <span key={item} className="rounded-lg border border-slate-300 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700">{item}</span>)}</div></Reveal>
            <Reveal delay={0.1}>
              <div className="relative rounded-[1.7rem] bg-[#101722] p-5 text-white shadow-[0_35px_90px_rgba(31,41,75,0.2)] sm:p-7">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><WifiOff className="h-5 w-5" /></div><div><p className="text-sm font-bold">Modo local activo</p><p className="mt-1 text-[0.65rem] text-slate-500">La operación no se detiene</p></div></div><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.7)]" /></div>
                <div className="mt-5 space-y-3">{[
                  ['Venta guardada', '$ 42.950', Check], ['Stock actualizado', '3 productos', PackageCheck], ['Pendiente de sincronizar', '1 operación', RefreshCcw],
                ].map(([label, value, Icon], index) => <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-white/[0.045] p-4"><Icon className={`h-4 w-4 ${index === 2 ? 'text-amber-300' : 'text-emerald-300'}`} /><span className="flex-1 text-xs font-medium text-slate-300">{String(label)}</span><span className="font-mono text-xs font-semibold text-white">{String(value)}</span></div>)}</div>
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4"><RefreshCcw className="h-4 w-4 text-emerald-300" /><p className="text-xs text-slate-400"><span className="font-semibold text-emerald-300">Al reconectar:</span> CajaGo envía lo pendiente sin duplicar la venta.</p></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6 sm:py-40 lg:px-8">
          <Reveal className="max-w-3xl"><Eyebrow>Todo conectado</Eyebrow><h2 className="text-balance text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-6xl">De la primera venta al cierre contable.</h2></Reveal>
          <div className="mt-14 flex flex-col gap-3 lg:min-h-[22rem] lg:flex-row">
            {featurePanels.map((panel) => {
              const Icon = panel.icon
              const active = activeFeature === panel.id
              return (
                <button key={panel.id} type="button" onClick={() => setActiveFeature(panel.id)} onMouseEnter={() => setActiveFeature(panel.id)} className={`group relative overflow-hidden rounded-[1.4rem] border p-7 text-left transition-[flex,border-color,background-color] duration-700 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8295ff] ${active ? 'flex-[2.4] border-[#8295ff]/35 bg-[#151d2a]' : 'flex-1 border-white/[0.08] bg-[#101720] hover:border-white/[0.16]'}`}>
                  <div className="flex h-full flex-col"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7185f3]/12 text-[#9aa9ff]"><Icon className="h-5 w-5" /></div><h3 className="mt-6 text-2xl font-bold text-white">{panel.title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{panel.subtitle}</p><ul className={`mt-6 space-y-3 transition-all duration-500 ${active ? 'translate-y-0 opacity-100' : 'lg:hidden'}`}>{panel.points.map((point) => <li key={point} className="flex items-center gap-2.5 text-xs text-slate-300"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />{point}</li>)}</ul></div>
                </button>
              )
            })}
          </div>
        </section>

        <section id="planes" className="border-y border-white/[0.08] bg-[#0c1119]">
          <div className="mx-auto max-w-[1120px] px-4 py-28 sm:px-6 sm:py-40 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center"><Eyebrow centered>Planes simples</Eyebrow><h2 className="text-balance text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-6xl">Pagás por el sistema. No por cada caja.</h2><p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-500">Probá todas las funciones durante {TRIAL_DAYS} días. Después elegís el nivel de gestión que necesita tu negocio.</p></Reveal>
            <div className="mt-16 grid gap-4 lg:grid-cols-3 lg:items-start">
              {(['basic', 'premium', 'vip'] as PlanId[]).map((id, index) => {
                const plan = PLANS[id]
                const highlighted = id === 'premium'
                return (
                  <Reveal key={id} delay={index * 0.08}>
                    <article className={`relative flex min-h-full flex-col rounded-[1.6rem] border p-7 sm:p-9 ${highlighted ? 'border-[#8295ff]/45 bg-[#171f2c] shadow-[0_35px_90px_rgba(0,0,0,0.3)]' : 'border-white/[0.09] bg-[#111821]'}`}>
                      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#aab6ff]">{plan.name}</p><p className="mt-3 max-w-sm text-sm text-slate-500">{plan.tagline}</p></div>{highlighted && <span className="rounded-md bg-[#7185f3] px-2.5 py-1 text-[0.62rem] font-bold text-white">RECOMENDADO</span>}</div>
                      <div className="mt-9 flex items-end gap-2 border-b border-white/[0.08] pb-8"><span className="font-mono text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">{formatPlanPrice(plan.price)}</span><span className="pb-1 text-xs text-slate-500">/ mes</span></div>
                      <ul className="flex-1 space-y-3.5 py-8">
                        {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />{feature}</li>)}
                        {plan.upcoming.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-500"><Clock3 className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-300" /><span>{feature} <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">Próximamente</span></span></li>)}
                      </ul>
                      <Link to="/register" className={`group inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 ${highlighted ? 'bg-white text-[#0a0e15] hover:bg-[#eef1ff]' : 'border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]'}`}>Empezar prueba gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
                    </article>
                  </Reveal>
                )
              })}
            </div>
            <p className="mt-8 text-center text-xs text-slate-600">Precios en pesos argentinos · Sin costos por usuario ni por caja · Sin permanencia</p>
          </div>
        </section>

        <section id="preguntas" className="mx-auto grid max-w-[1120px] gap-14 px-4 py-28 sm:px-6 sm:py-40 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <Reveal><Eyebrow>Antes de empezar</Eyebrow><h2 className="text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl">Preguntas concretas. Respuestas claras.</h2><p className="mt-6 max-w-sm text-sm leading-7 text-slate-500">Si necesitás revisar un caso particular, podés escribirnos antes de crear tu cuenta.</p></Reveal>
          <Reveal delay={0.08} className="border-t border-white/[0.09]">{faqs.map((faq) => <FaqItem key={faq.question} {...faq} />)}</Reveal>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-[#eef0f8] px-6 py-16 text-[#101521] sm:px-12 sm:py-20 lg:px-16">
              <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#8295ff]/30 blur-[80px]" /><div className="absolute bottom-0 right-[28%] h-32 w-32 rounded-full bg-white/70 blur-[60px]" />
              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end"><div className="max-w-3xl"><p className="text-sm font-semibold text-[#5367d3]">Tu negocio, con menos improvisación</p><h2 className="mt-5 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-6xl">Probalo en una jornada real. No en una demo vacía.</h2><p className="mt-6 max-w-xl text-base leading-8 text-slate-600">Cargá tus productos, abrí caja y comprobá cómo se siente trabajar con toda la operación conectada.</p></div><Link to="/register" className="group inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-3 rounded-xl bg-[#101521] px-7 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1b2433] active:translate-y-0">Empezar {TRIAL_DAYS} días gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link></div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] bg-[#080c12]">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-9 md:flex-row md:items-end md:justify-between"><div><CajaGoBrand size="sm" /><p className="mt-4 max-w-sm text-xs leading-6 text-slate-600">Ventas, stock, caja y gestión para comercios que necesitan trabajar con claridad.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-500"><a href="#producto" className="hover:text-white">Producto</a><a href="#sin-internet" className="hover:text-white">Sin internet</a><a href="#planes" className="hover:text-white">Planes</a><Link to="/login" className="hover:text-white">Ingresar</Link></div></div>
          <div className="mt-10 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-[0.68rem] text-slate-700 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} CajaGo. Argentina.</p><div className="flex gap-5"><Link to="/terminos" className="hover:text-white">Términos</Link><Link to="/privacidad" className="hover:text-white">Privacidad</Link><a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener" className="hover:text-white">Soporte</a></div></div>
        </div>
      </footer>
    </div>
  )
}

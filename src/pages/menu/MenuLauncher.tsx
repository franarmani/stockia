import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { supabase } from '@/lib/supabase'
import { calculateRemainingDays } from '@/lib/subscription'
import BentoCard from '@/components/menu/BentoCard'
import { GlassButton } from '@/components/ui/GlassCard'
import { formatCurrency, cn } from '@/lib/utils'
import { useBasicModeStore, BASIC_MODE_ALLOWED_HREFS } from '@/features/basic_mode/basicModeStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useNotificationsStore } from '@/features/notifications/notificationsStore'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  FileText,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  Bell,
  CalendarDays,
  Clock,
  CheckCircle2,
  Zap,
  Crown,
  Cpu,
  Building2,
  Headphones,
  Check,
  Star,
  ArrowRight,
  PlayCircle
} from 'lucide-react'

interface QuickStats {
  todaySales: number
  todayCount: number
  lowStockCount: number
  cajaOpen: boolean
  lowStockItems: any[]
}

const ALL_MODULES = [
  { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, color: 'bg-green-500/20', iconColor: 'text-green-400', description: 'Stats del día' },
  { name: 'Punto de venta', href: '/pos', icon: ShoppingCart, color: 'bg-blue-500/20', iconColor: 'text-blue-400', description: 'Nueva venta' },
  { name: 'Productos', href: '/products', icon: Package, color: 'bg-violet-500/20', iconColor: 'text-violet-400', description: 'Inventario' },
  { name: 'Compras', href: '/purchases', icon: Truck, color: 'bg-amber-500/20', iconColor: 'text-amber-400', description: 'Órdenes' },
  { name: 'Clientes', href: '/customers', icon: Users, color: 'bg-cyan-500/20', iconColor: 'text-cyan-400', description: 'Cuenta corriente' },
  { name: 'Comprobantes', href: '/comprobantes', icon: FileText, color: 'bg-indigo-500/20', iconColor: 'text-indigo-400', description: 'AFIP' },
  { name: 'Caja', href: '/cash-register', icon: Wallet, color: 'bg-rose-500/20', iconColor: 'text-rose-400', description: 'Apertura' },
  { name: 'Historial', href: '/sales', icon: Receipt, color: 'bg-teal-500/20', iconColor: 'text-teal-400', description: 'Ventas' },
  { name: 'Reportes', href: '/reports', icon: BarChart3, color: 'bg-orange-500/20', iconColor: 'text-orange-400', description: 'Análisis' },
  { name: 'Configuración', href: '/settings', icon: Settings, color: 'bg-slate-500/20', iconColor: 'text-slate-300', description: 'Negocio' },
  { name: 'Salud', href: '/health', icon: Activity, color: 'bg-emerald-500/20', iconColor: 'text-emerald-400', description: 'Estado' },
  { name: 'Notificaciones', href: '/notifications', icon: Bell, color: 'bg-purple-500/20', iconColor: 'text-purple-400', description: 'Alertas' },
  { name: 'Resúmenes', href: '/daily-summary', icon: CalendarDays, color: 'bg-indigo-500/20', iconColor: 'text-indigo-400', description: 'Cierres' },
  { name: 'Música', href: '/music', icon: Headphones, color: 'bg-amber-500/20', iconColor: 'text-amber-400', description: 'Pro', premium: true },
]

export default function MenuLauncher() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const { basicMode } = useBasicModeStore()
  const { currentTrack, isPlaying } = useMusicStore()
  const { unreadCount, fetch: fetchNotifications } = useNotificationsStore()

  const visibleModules = basicMode
    ? ALL_MODULES.filter(m => BASIC_MODE_ALLOWED_HREFS.has(m.href))
    : ALL_MODULES

  useEffect(() => {
    if (profile?.business_id) {
      fetchQuickStats()
      fetchNotifications(profile.business_id)
    }
  }, [profile?.business_id])

  async function fetchQuickStats() {
    if (!profile) return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [salesRes, lowStockRes, cajaRes] = await Promise.all([
      supabase.from('sales').select('total').eq('business_id', profile.business_id).gte('created_at', start),
      supabase.from('products').select('name, stock').eq('business_id', profile.business_id).eq('active', true).lte('stock', 5).limit(3),
      supabase.from('cash_sessions').select('id').eq('business_id', profile.business_id).eq('status', 'open').limit(1),
    ])

    const todayData = salesRes.data ?? []
    setStats({
      todaySales: todayData.reduce((s: number, v: any) => s + v.total, 0),
      todayCount: todayData.length,
      lowStockCount: lowStockRes.data?.length ?? 0,
      cajaOpen: (cajaRes.data?.length ?? 0) > 0,
      lowStockItems: lowStockRes.data ?? []
    })
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Usuario'
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-fade-in flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* ── Welcome header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-black">{today}</p>
          <h1 className="text-3xl font-black text-white mt-1 tracking-tight">
            Hola, {firstName}
          </h1>
          {business?.name && (
            <div className="flex items-center gap-2 mt-1">
               <Building2 className="w-3.5 h-3.5 text-amber-500/50" />
               <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{business.name}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 group"
        >
          <Bell className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-amber-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-950 leading-none">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </div>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 p-1">
        
        {/* HERO: PUNTO DE VENTA (4x2) */}
        <BentoCard
          title="Punto de Venta"
          description="Venta rápida y gestión"
          icon={ShoppingCart}
          href="/pos"
          colSpan="col-span-2 md:col-span-4"
          rowSpan="row-span-2"
          iconBackground="bg-green-500"
          iconColor="text-slate-950"
          className="ring-2 ring-green-500/20 bg-green-500/5 border-green-500/10"
        >
          <div className="mt-4 flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-1 p-5 rounded-[2rem] bg-white/5 border border-white/5 flex flex-col justify-center">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-1">Ventas Hoy</p>
              <h2 className="text-3xl font-black text-white">{stats ? formatCurrency(stats.todaySales) : '--'}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">{stats?.todayCount || 0} Operaciones</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('/pos') }}
                className="group/btn relative w-full h-16 rounded-[2rem] bg-green-500 text-slate-950 hover:bg-green-400 transition-all font-black flex items-center justify-between px-8 overflow-hidden"
              >
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[9px] uppercase tracking-widest opacity-60 mb-0.5">Terminal</span>
                  <span className="text-sm uppercase tracking-widest">Nueva Venta</span>
                </div>
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Ticket Prom.</p>
                  <p className="text-xs font-bold text-white">
                    {stats?.todayCount ? formatCurrency(stats.todaySales / stats.todayCount) : '--'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                   <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Estado</p>
                   <p className="text-xs font-bold text-green-400 uppercase">Activo</p>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* INVENTORY (2x2) */}
        <BentoCard
          title="Stock"
          description="Inventario Crítico"
          icon={Package}
          href="/products"
          colSpan="col-span-2 md:col-span-2"
          rowSpan="row-span-2"
          iconBackground="bg-violet-500/20"
          iconColor="text-violet-400"
          badge={stats?.lowStockCount}
        >
          <div className="mt-4 flex flex-col h-full bg-slate-950/20 rounded-[2rem] p-4 border border-white/5">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-black mb-3 text-center">Alertas de Stock</p>
            <div className="space-y-2 flex-1 overflow-auto custom-scrollbar pr-1">
              {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
                stats.lowStockItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-amber-500/70 font-black">Stock: {item.stock}</p>
                    </div>
                    <AlertTriangle className="w-3 h-3 text-amber-500/50" />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                   <CheckCircle2 className="w-8 h-8 mb-2" />
                   <p className="text-[9px] font-black uppercase tracking-widest">Todo en orden</p>
                </div>
              )}
            </div>
            <GlassButton size="sm" className="w-full mt-4 h-10 rounded-2xl" onClick={() => navigate('/products')}>Gestionar</GlassButton>
          </div>
        </BentoCard>

        {/* ANALYTICS (3x1) */}
        <BentoCard
          title="Reportes"
          description="Crecimiento y Análisis"
          icon={BarChart3}
          href="/reports"
          colSpan="col-span-2 md:col-span-3"
          iconBackground="bg-orange-500/20"
          iconColor="text-orange-400"
        >
          <div className="mt-2 flex items-center justify-between gap-6 px-2">
             <div className="flex flex-col">
                <p className="text-lg font-black text-white tracking-tighter">Stockia Insights</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <Activity className="w-3 h-3 text-white/20" />
                   <p className="text-[8px] text-white/20 uppercase tracking-widest font-bold">Datos en tiempo real</p>
                </div>
             </div>
             <div className="flex-1 h-10 flex items-end gap-1 px-4 max-w-[150px]">
                {[4,7,5,9,6,8,10,7,5].map((h, i) => (
                  <div key={i} className="flex-1 bg-orange-500/30 rounded-t-[2px] hover:bg-orange-400/50 transition-colors" style={{ height: `${h * 10}%` }} />
                ))}
             </div>
          </div>
        </BentoCard>

        {/* CAJA (3x1) */}
        <BentoCard
          title="Caja"
          description="Estado de fondos"
          icon={Wallet}
          href="/cash-register"
          colSpan="col-span-2 md:col-span-3"
          iconBackground={stats?.cajaOpen ? "bg-emerald-500/20" : "bg-red-500/20"}
          iconColor={stats?.cajaOpen ? "text-emerald-400" : "text-red-400"}
        >
          <div className="mt-2 flex items-center justify-between px-2">
             <div className="flex flex-col">
                <p className="text-xs font-bold text-white/60">Sesión Actual</p>
                <p className="text-sm font-black text-white">{stats?.cajaOpen ? 'OPERATIVA' : 'CERRADA'}</p>
             </div>
             <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                stats?.cajaOpen ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" : "bg-red-500/5 text-red-400 border-red-500/20"
             )}>
                <div className={cn("w-2 h-2 rounded-full", stats?.cajaOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                {stats?.cajaOpen ? 'Disponible' : 'Cerrada'}
             </div>
          </div>
        </BentoCard>

        {/* MUSICA / AMBIENTE (6x1) - Full Wide sleek bar */}
        <BentoCard
          title="Stockia Music"
          description={isPlaying ? "Sonando ahora" : "Ambientación musical"}
          icon={Headphones}
          href="/music"
          colSpan="col-span-full md:col-span-6"
          iconBackground="bg-amber-500/20"
          iconColor="text-amber-400"
          className={cn("bg-gradient-to-r transition-all duration-700 h-24", isPlaying ? "from-amber-500/10 via-transparent to-transparent border-amber-500/20" : "")}
        >
          <div className="mt-1 flex items-center justify-between gap-6 pr-2">
             {currentTrack ? (
               <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/10">
                     <PlayCircle className={cn("w-6 h-6 text-amber-500", isPlaying && "animate-spin-slow")} />
                  </div>
                  <div className="min-w-0">
                     <p className="text-sm font-black text-white truncate leading-tight">{currentTrack.title}</p>
                     <p className="text-[10px] text-white/30 truncate uppercase tracking-widest font-bold">{currentTrack.artist}</p>
                  </div>
               </div>
             ) : (
               <div className="flex items-center gap-3 opacity-30">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium italic">Seleccioná una playlist para empezar</p>
               </div>
             )}
             
             <div className="flex items-center gap-2">
               <div className="hidden md:flex items-center gap-1 mr-4">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className={cn("w-1 rounded-full bg-amber-500/40", isPlaying ? "animate-pulse" : "h-1")} style={{ height: isPlaying ? `${Math.random() * 20 + 4}px` : '4px', animationDelay: `${i * 100}ms` }} />
                  ))}
               </div>
               <GlassButton size="sm" className="h-10 px-6 rounded-2xl" onClick={() => navigate('/music')}>
                 <span className="text-[10px] uppercase tracking-widest font-black mr-2">Abrir</span>
                 <ArrowRight className="w-3.5 h-3.5" />
               </GlassButton>
             </div>
          </div>
        </BentoCard>

        {/* OTHER MODULES - Grouped / Sleeker Grid */}
        <div className="col-span-full mt-4 space-y-4">
           <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Gestión y Operaciones</p>
           </div>
           
           <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {visibleModules
                .filter(m => !['/pos', '/reports', '/products', '/music', '/cash-register'].includes(m.href))
                .map((mod) => (
                <button
                  key={mod.href}
                  onClick={() => navigate(mod.href)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-center group"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", mod.color)}>
                    <mod.icon className={cn("w-5 h-5", mod.iconColor)} />
                  </div>
                  <p className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors">{mod.name}</p>
                </button>
              ))}
              
              {/* Settings shortcut always last */}
              <button
                  onClick={() => navigate('/settings')}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center transition-all group-hover:rotate-45">
                    <Settings className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors">Ajustes</p>
                </button>
           </div>
        </div>

      </div>

      {/* ── Subscription status section ── */}
      {business && (() => {
        const trialEnd = business.trial_ends_at ? new Date(business.trial_ends_at) : null
        const now = new Date()
        if (business.subscription_status === 'trial' && trialEnd) {
          const diffMs = trialEnd.getTime() - now.getTime()
          const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
          const isUrgent = daysLeft <= 5

          return (
            <div className={cn(
              "p-6 rounded-[2.5rem] mt-4 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden",
              isUrgent ? "bg-amber-500/5 border border-amber-500/10" : "bg-blue-500/5 border border-blue-500/10"
            )}>
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                 <Crown className={cn("w-8 h-8", isUrgent ? "text-amber-500" : "text-blue-500")} />
              </div>
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-xl font-black text-white tracking-tight">Periodo de Prueba Activo</h3>
                 <p className="text-sm text-white/40 mt-1">Te quedan <span className={cn("font-bold text-white", isUrgent && "text-amber-500")}>{daysLeft} días</span> para disfrutar de todas las funciones premium.</p>
              </div>
              <button 
                onClick={() => navigate('/settings')}
                className={cn(
                   "px-8 h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95",
                   isUrgent ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20" : "bg-blue-600 text-white"
                )}
              >
                Suscribirme ahora
              </button>
            </div>
          )
        }
        return null
      })()}

      {/* ── Tu Plan y Suscripción ── */}
      <div className="space-y-4 px-1 mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Tu Plan y Suscripción</p>
          {business?.subscription_status === 'trial' && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold animate-pulse-soft">
              Periodo de Prueba
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Plan Inicial */}
          <div className={`glass-card p-5 relative overflow-hidden flex flex-col justify-between border-white/5 ${business?.plan === 'basic' ? 'ring-2 ring-slate-500/50 bg-slate-500/5' : 'opacity-60'}`}>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight">Plan Inicial</h3>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Básico</p>
                </div>
                {business?.plan === 'basic' && <CheckCircle2 className="w-5 h-5 text-slate-500" />}
              </div>
              <ul className="space-y-2">
                {['Ventas básicas', 'Stock limitado', 'Facturación AFIP'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-white/60">
                    <Check className="w-3.5 h-3.5 text-slate-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button disabled className="mt-5 w-full h-9 rounded-xl bg-white/5 text-white/20 text-xs font-bold cursor-not-allowed uppercase tracking-widest">
              Plan Actual
            </button>
          </div>

          {/* Plan Negocio */}
          <div className={`glass-card p-5 relative overflow-hidden flex flex-col justify-between border-blue-500/20 ${business?.plan === 'pro' || !business?.plan ? 'ring-2 ring-blue-500/50 bg-blue-500/10 shadow-xl shadow-blue-500/5' : 'opacity-80'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Star className="w-20 h-20 text-blue-400" />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight">Plan Negocio</h3>
                  <p className="text-[11px] text-blue-400 font-black">$50.000 <span className="text-[9px] font-normal text-white/40">/ mes</span></p>
                </div>
                {(business?.plan === 'pro' || !business?.plan) && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
              </div>
              <ul className="space-y-2">
                {['Facturación AFIP ilimitada', 'Radar AI (Solo 1 mes)', 'Usuarios ilimitados'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-white/80 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">Plan Activo</p>
            </div>
          </div>

          {/* Plan Premium */}
          <div className={`glass-card p-5 relative overflow-hidden flex flex-col justify-between border-amber-500/30 ${business?.plan === 'premium' ? 'ring-2 ring-amber-500/50 bg-amber-500/5 shadow-2xl shadow-amber-500/10' : ''}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Crown className="w-20 h-20 text-amber-500" />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight">Plan Premium</h3>
                  <p className="text-[11px] text-amber-500 font-black">$100.000 <span className="text-[9px] font-normal text-white/40">/ mes</span></p>
                </div>
                {business?.plan === 'premium' && <CheckCircle2 className="w-5 h-5 text-amber-500" />}
              </div>
              <ul className="space-y-2">
                {['Radar AI Profesional', 'Gestión Multisucursal', 'Soporte VIP 24/7'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] text-white/90 font-bold">
                    <Check className="w-3.5 h-3.5 text-amber-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <a 
              href="https://wa.me/5492915716099?text=Hola!%20Quiero%20mejorar%20mi%20plan%20a%20Premium%20en%20Stockia."
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all uppercase tracking-[0.2em]"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              Upgrade Premium
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}

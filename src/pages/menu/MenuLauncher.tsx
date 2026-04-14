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
    <div className="animate-fade-in flex flex-col gap-3 max-w-6xl mx-auto w-full pb-8 px-4">
      {/* ── TOP BAR: Profile & Ribbon Header ── */}
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center font-black text-amber-500 text-sm">
            {firstName[0]}
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-white leading-none tracking-tight">Dashboard</h1>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">{business?.name || 'Stockia Enterprise'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
             <Clock className="w-3 h-3 text-white/20" />
             <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{today}</span>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 group"
          >
            <Bell className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[1.2rem] h-4.5 px-1 bg-amber-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                <span className="text-[9px] font-black text-slate-950 leading-none">{unreadCount}</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── OPERATIONAL RIBBON: Immediate access to all 'lost' modules ── */}
      <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 gap-2 py-1">
         {visibleModules
            .filter(m => !['/pos', '/reports', '/products', '/music', '/cash-register', '/dashboard', '/settings'].includes(m.href))
            .map((mod) => (
            <button
              key={mod.href}
              onClick={() => navigate(mod.href)}
              className="group flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform", mod.color)}>
                <mod.icon className={cn("w-4 h-4", mod.iconColor)} />
              </div>
              <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter group-hover:text-white transition-colors truncate w-full text-center">
                {mod.name}
              </span>
            </button>
         ))}
      </div>

      {/* ── CORE GRID: 12-Column System ── */}
      <div className="grid grid-cols-12 gap-2.5">
        
        {/* HERO: POS (8/12) */}
        <BentoCard
          title="Terminal POS"
          icon={ShoppingCart}
          href="/pos"
          className="col-span-12 md:col-span-8 ring-1 ring-green-500/20 bg-green-500/[0.03]"
        >
          <div className="mt-2 flex flex-col sm:flex-row items-center gap-6 h-full">
            <div className="flex-1 flex flex-col justify-center">
               <p className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-1">Volumen del Día</p>
               <h2 className="text-4xl font-black text-white tracking-tighter">{stats ? formatCurrency(stats.todaySales) : '--'}</h2>
               <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/10">
                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">{stats?.todayCount} Vtas</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                    <Activity className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Live</span>
                  </div>
               </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); navigate('/pos') }}
              className="w-full sm:w-auto px-8 h-16 rounded-2xl bg-green-500 text-slate-950 hover:bg-green-400 transition-all font-black flex flex-col items-center justify-center group/p relative overflow-hidden shrink-0"
            >
              <div className="flex items-center gap-2 relative z-10">
                <span className="text-sm uppercase tracking-widest">Nueva Venta</span>
                <ArrowRight className="w-5 h-5 group-hover/p:translate-x-1 transition-transform" />
              </div>
              <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/p:animate-shimmer" />
            </button>
          </div>
        </BentoCard>

        {/* ALERTS: STOCK (4/12) */}
        <BentoCard
          title="Stock Crítico"
          icon={Package}
          href="/products"
          badge={stats?.lowStockCount}
          className="col-span-12 md:col-span-4"
        >
          <div className="mt-2 space-y-2 h-full">
            {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
              stats.lowStockItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] font-bold text-white/80 truncate">{item.name}</span>
                  <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/10">
                    {item.stock} UN.
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <CheckCircle2 className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Inventario OK</p>
              </div>
            )}
          </div>
        </BentoCard>

        {/* INSIGHTS (4/12) */}
        <BentoCard
          title="Insights"
          icon={BarChart3}
          href="/reports"
          className="col-span-6 md:col-span-4"
        >
          <div className="mt-1 flex items-end justify-between gap-1 h-12 bg-white/[0.02] rounded-xl p-2 border border-white/5">
            {[3,7,4,9,6,8,10,5,7,4,6,8].map((h, i) => (
              <div key={i} className="flex-1 bg-blue-500/30 rounded-t-[1px]" style={{ height: `${h * 10}%` }} />
            ))}
          </div>
        </BentoCard>

        {/* CAJA (4/12) */}
        <BentoCard
          title="Sesión de Caja"
          icon={Wallet}
          href="/cash-register"
          className="col-span-6 md:col-span-4"
        >
          <div className="mt-1 flex flex-col justify-center h-full">
             <div className={cn(
                "flex items-center justify-between px-3 h-12 rounded-xl border font-black uppercase tracking-widest text-[10px]",
                stats?.cajaOpen ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
             )}>
                <span>{stats?.cajaOpen ? 'Operativa' : 'Cerrada'}</span>
                <div className={cn("w-2 h-2 rounded-full", stats?.cajaOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
             </div>
          </div>
        </BentoCard>

        {/* SETTINGS/STATUS (4/12) */}
        <BentoCard
          title="Terminal Config"
          icon={Settings}
          href="/settings"
          className="col-span-12 md:col-span-4 bg-slate-500/[0.03]"
        >
          <div className="mt-1 flex items-center justify-between gap-2 h-12">
             <div className="flex flex-col">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">V-Core</p>
                <p className="text-xs font-black text-white">Stockia v4.2.0</p>
             </div>
             <button onClick={(e) => { e.stopPropagation(); navigate('/settings') }} className="px-4 h-9 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                Ajustes
             </button>
          </div>
        </BentoCard>

        {/* MUSIC STRIP (Full Wide) */}
        <BentoCard
          title="Ambiente Musical"
          icon={Headphones}
          href="/music"
          className={cn("col-span-12 bg-gradient-to-r", isPlaying ? "from-amber-500/10 to-transparent border-amber-500/20" : "")}
        >
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg">
                    <PlayCircle className={cn("w-5 h-5 text-amber-500", isPlaying && "animate-spin-slow")} />
                 </div>
                 <div className="flex flex-col">
                    <p className="text-xs font-black text-white leading-none mb-1">{currentTrack?.title || 'Radio Stockia Pro'}</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{currentTrack?.artist || 'Intelligent Background'}</p>
                 </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('/music') }}
                className="h-10 px-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-500/20"
              >
                Configurar Música
              </button>
           </div>
        </BentoCard>
      </div>

      {/* ── PLANS & SUBSCRIPTION: Restored & Refined ── */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-4 px-1">
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em]">Estado de Suscripción</p>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Plan Básico */}
          <div className={`p-4 rounded-xl border transition-all ${business?.plan === 'basic' ? 'bg-slate-500/10 border-slate-500/30' : 'bg-white/[0.01] border-white/5 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Plan Inicial</h3>
                <p className="text-[10px] text-white/20 uppercase mt-1">Básico</p>
              </div>
              {business?.plan === 'basic' && <CheckCircle2 className="w-4 h-4 text-slate-500" />}
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed mb-4">Ideal para pequeños comercios.</p>
            <div className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest">
               <Check className="w-3 h-3" /> Ventas Básicas
            </div>
          </div>

          {/* Plan Pro */}
          <div className={`p-4 rounded-xl border transition-all ${business?.plan === 'pro' || !business?.plan ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-white/[0.01] border-white/5'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Plan Negocio</h3>
                <p className="text-[10px] text-blue-400 uppercase mt-1">$50.000 / mes</p>
              </div>
              {(business?.plan === 'pro' || !business?.plan) && <Star className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="space-y-1.5 mb-4">
               {['Facturación Ilimitada', 'Usuarios Multiples'].map(f => (
                 <div key={f} className="flex items-center gap-2 text-[9px] font-black text-blue-400/70 uppercase tracking-widest">
                    <Check className="w-3 h-3" /> {f}
                 </div>
               ))}
            </div>
            {(business?.plan === 'pro' || !business?.plan) && <div className="text-center py-1 rounded-lg bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-[0.2em]">Suscripción Activa</div>}
          </div>

          {/* Plan Premium */}
          <div className={`p-4 rounded-xl border transition-all ${business?.plan === 'premium' ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20 shadow-xl shadow-amber-500/5' : 'bg-white/[0.01] border-white/5'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Plan Premium</h3>
                <p className="text-[10px] text-amber-500 uppercase mt-1">$100.000 / mes</p>
              </div>
              {business?.plan === 'premium' ? <Crown className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-amber-500/40" />}
            </div>
            <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-4">Radar AI & Multisucursal</p>
            <a 
              href="https://wa.me/5492915716099?text=Hola!%20Quiero%20Upgrade%20a%20Premium."
              target="_blank"
              className="block text-center py-2 rounded-lg bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-[0.2em] hover:brightness-110"
            >
              UPGRADE VIP
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

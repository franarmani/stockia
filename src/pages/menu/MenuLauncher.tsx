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
    <div className="animate-fade-in flex flex-col gap-4 max-w-7xl mx-auto w-full pb-8">
      {/* ── Welcome header (Compacted) ── */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              Hola, {firstName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
               <Building2 className="w-3 h-3 text-amber-500/50" />
               <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{business?.name || 'Stockia'}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/5 hidden sm:block" />
          <div className="hidden sm:block">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-black">{today}</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 group"
        >
          <Bell className="w-4.5 h-4.5 text-white/40 group-hover:text-white transition-colors" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[1.2rem] h-4.5 px-1 bg-amber-500 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg">
              <span className="text-[9px] font-black text-slate-950 leading-none">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </div>

      {/* ── Bento Grid (Compact & Dense) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-1">
        
        {/* HERO: PUNTO DE VENTA (4x2) */}
        <BentoCard
          title="Terminal de Venta"
          description="POS Fast-Track"
          icon={ShoppingCart}
          href="/pos"
          colSpan="col-span-2 md:col-span-4"
          rowSpan="row-span-2"
          iconBackground="bg-green-500"
          iconColor="text-slate-950"
          className="ring-1 ring-green-500/20 bg-green-500/5"
        >
          <div className="mt-2 flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">Ventas Hoy</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">{stats ? formatCurrency(stats.todaySales) : '--'}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/10">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">{stats?.todayCount || 0} Ops</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('/pos') }}
                className="group/btn relative w-full h-14 rounded-2xl bg-green-500 text-slate-950 hover:bg-green-400 transition-all font-black flex items-center justify-between px-6 overflow-hidden"
              >
                <span className="text-[11px] uppercase tracking-widest leading-none">Nueva Venta</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/btn:animate-shimmer" />
              </button>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                  <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5 font-bold">Ticket</p>
                  <p className="text-[10px] font-black text-white truncate">
                    {stats?.todayCount ? formatCurrency(stats.todaySales / stats.todayCount) : '--'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center">
                   <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5 font-bold">Caja</p>
                   <div className="flex items-center gap-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full", stats?.cajaOpen ? "bg-green-500" : "bg-red-500")} />
                      <span className="text-[9px] font-black text-white uppercase tracking-tighter">{stats?.cajaOpen ? 'Alt' : 'Off'}</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* STOCK (2x2) */}
        <BentoCard
          title="Stock"
          description="Críticos"
          icon={Package}
          href="/products"
          colSpan="col-span-2 md:col-span-2"
          rowSpan="row-span-2"
          iconBackground="bg-violet-500/20"
          iconColor="text-violet-400"
          badge={stats?.lowStockCount}
        >
          <div className="mt-2 flex flex-col h-full bg-slate-950/30 rounded-2xl p-3 border border-white/5">
            <div className="space-y-1.5 flex-1 overflow-auto custom-scrollbar pr-1">
              {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
                stats.lowStockItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate leading-none mb-1">{item.name}</p>
                      <p className="text-[9px] text-amber-500/70 font-black tracking-widest">STOCK: {item.stock}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                   <CheckCircle2 className="w-8 h-8" />
                </div>
              )}
            </div>
            <GlassButton size="sm" className="w-full mt-3 h-9 rounded-xl text-[10px] uppercase tracking-widest font-black" onClick={() => navigate('/products')}>Inventario</GlassButton>
          </div>
        </BentoCard>

        {/* ANALYTICS (3x1) */}
        <BentoCard
          title="Reportes"
          href="/reports"
          colSpan="col-span-2 md:col-span-3"
          icon={BarChart3}
          iconBackground="bg-orange-500/20"
          iconColor="text-orange-400"
        >
          <div className="mt-1 flex items-center justify-between px-1">
             <div className="flex flex-col">
                <p className="text-md font-black text-white tracking-widest uppercase">Insights</p>
                <div className="flex items-center gap-1 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                   <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-black">Live Stats</p>
                </div>
             </div>
             <div className="flex-1 h-8 flex items-end gap-1 px-4 max-w-[120px]">
                {[4,7,5,9,6,8,10,7].map((h, i) => (
                  <div key={i} className="flex-1 bg-orange-500/20 rounded-t-[1px]" style={{ height: `${h * 10}%` }} />
                ))}
             </div>
          </div>
        </BentoCard>

        {/* CAJA (3x1) */}
        <BentoCard
          title="Caja"
          href="/cash-register"
          colSpan="col-span-2 md:col-span-3"
          icon={Wallet}
          iconBackground={stats?.cajaOpen ? "bg-emerald-500/20" : "bg-red-500/20"}
          iconColor={stats?.cajaOpen ? "text-emerald-400" : "text-red-400"}
        >
          <div className="mt-1 flex items-center justify-between px-1">
             <div className="flex flex-col">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Sesión</p>
                <p className="text-sm font-black text-white tracking-tighter">{stats?.cajaOpen ? 'OPERANDO' : 'INACTIVA'}</p>
             </div>
             <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest",
                stats?.cajaOpen ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
             )}>
                {stats?.cajaOpen ? 'Caja Abierta' : 'Caja Cerrada'}
             </div>
          </div>
        </BentoCard>

        {/* MUSIC (Full height sleek bar) */}
        <BentoCard
          title="Stockia Music"
          href="/music"
          colSpan="col-span-full"
          icon={Headphones}
          iconBackground="bg-amber-500/20"
          iconColor="text-amber-400"
          className={cn("bg-gradient-to-r h-20", isPlaying ? "from-amber-500/10 to-transparent border-amber-500/20" : "")}
        >
          <div className="flex items-center justify-between gap-4 pr-1">
             <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/10">
                   <PlayCircle className={cn("w-5 h-5 text-amber-500", isPlaying && "animate-spin-slow")} />
                </div>
                <div className="min-w-0">
                   <p className="text-xs font-black text-white truncate leading-none mb-1">{currentTrack?.title || 'Ambiente Stockia'}</p>
                   <p className="text-[9px] text-white/30 truncate uppercase tracking-[0.2em] font-black">{currentTrack?.artist || 'Pro-Final'}</p>
                </div>
             </div>
             
             <button onClick={(e) => { e.stopPropagation(); navigate('/music') }} className="h-9 px-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2 group/m">
                <span>Reproductor</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/m:translate-x-1 transition-transform" />
             </button>
          </div>
        </BentoCard>

        {/* OPERACIONES SECUNDARIAS (Ultra Compact Grid) */}
        <div className="col-span-full grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 mt-2">
            {visibleModules
              .filter(m => !['/pos', '/reports', '/products', '/music', '/cash-register'].includes(m.href))
              .map((mod) => (
              <button
                key={mod.href}
                onClick={() => navigate(mod.href)}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-center group"
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform", mod.color)}>
                  <mod.icon className={cn("w-4.5 h-4.5", mod.iconColor)} />
                </div>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-tighter group-hover:text-white transition-colors">{mod.name}</p>
              </button>
            ))}
            
            <button
              onClick={() => navigate('/settings')}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-center group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-500/20 flex items-center justify-center shadow-lg group-hover:rotate-45 transition-transform">
                <Settings className="w-4.5 h-4.5 text-slate-400" />
              </div>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-tighter group-hover:text-white transition-colors">Ajustes</p>
            </button>
        </div>
      </div>

      {/* ── FOOTER: Subscription & Support (Tighter) ── */}
      {business?.subscription_status === 'trial' && (
        <div className="px-2 mt-2">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                   <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                   <h3 className="text-sm font-black text-white tracking-widest uppercase italic">Plan Trial Activo</h3>
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Disfrutá Stockia Pro sin límites</p>
                </div>
              </div>
              <button onClick={() => navigate('/settings')} className="px-6 h-9 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
                Suscribirme
              </button>
            </div>
        </div>
      )}
    </div>
  )
}
}

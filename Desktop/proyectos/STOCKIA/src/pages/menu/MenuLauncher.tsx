import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { supabase } from '@/lib/supabase'
import ModuleTile from '@/components/ModuleTile'
import { GlassButton } from '@/components/ui/GlassCard'
import { formatCurrency } from '@/lib/utils'
import { useBasicModeStore, BASIC_MODE_ALLOWED_HREFS } from '@/features/basic_mode/basicModeStore'
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
  MessageCircle,
  Music2,
} from 'lucide-react'
import { useMusicPlayer } from '@/stores/musicPlayerStore'

interface QuickStats {
  todaySales: number
  todayCount: number
  lowStockCount: number
  cajaOpen: boolean
}

const MODULES = [
  {
    name: 'Inicio',
    href: '/dashboard',
    icon: LayoutDashboard,
    color: 'bg-green-500/20',
    iconColor: 'text-green-400',
    description: 'Stats del día',
    shortcut: 'I',
  },
  {
    name: 'Punto de venta',
    href: '/pos',
    icon: ShoppingCart,
    color: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    description: 'Nueva venta',
    shortcut: 'V',
  },
  {
    name: 'Productos',
    href: '/products',
    icon: Package,
    color: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    description: 'Inventario',
    shortcut: 'P',
  },
  {
    name: 'Compras',
    href: '/purchases',
    icon: Truck,
    color: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    description: 'Órdenes de compra',
    shortcut: 'C',
  },
  {
    name: 'Clientes',
    href: '/customers',
    icon: Users,
    color: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    description: 'Cuenta corriente',
    shortcut: 'L',
  },
  {
    name: 'Comprobantes',
    href: '/comprobantes',
    icon: FileText,
    color: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    description: 'Facturas AFIP',
    shortcut: 'F',
  },
  {
    name: 'Caja',
    href: '/cash-register',
    icon: Wallet,
    color: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    description: 'Apertura / cierre',
    shortcut: 'J',
  },
  {
    name: 'Historial',
    href: '/sales',
    icon: Receipt,
    color: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
    description: 'Ventas pasadas',
    shortcut: 'H',
  },
  {
    name: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    color: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    description: 'Análisis y gráficos',
    shortcut: 'R',
  },
  {
    name: 'WhatsApp',
    href: '/whatsapp',
    icon: MessageCircle,
    color: 'bg-emerald-500/20',
    iconColor: 'text-[#25D366]',
    description: 'Chat con clientes',
    shortcut: 'W',
  },
  {
    name: 'Configuración',
    href: '/settings',
    icon: Settings,
    color: 'bg-slate-500/20',
    iconColor: 'text-slate-300',
    description: 'Negocio y AFIP',
    shortcut: 'S',
  },
  {
    name: 'Música',
    href: '/music',
    icon: Music2,
    color: 'bg-primary/20',
    iconColor: 'text-primary',
    description: 'Ambiente Premium',
    shortcut: undefined,
  },
  {
    name: 'Salud',
    href: '/health',
    icon: Activity,
    color: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    description: 'Estado del negocio',
    shortcut: undefined,
  },
  {
    name: 'Notificaciones',
    href: '/notifications',
    icon: Bell,
    color: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    description: 'Alertas y avisos',
    shortcut: undefined,
  },
  {
    name: 'Resúmenes',
    href: '/daily-summary',
    icon: CalendarDays,
    color: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    description: 'Cierres diarios',
    shortcut: undefined,
  },
]

export default function MenuLauncher() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const { basicMode } = useBasicModeStore()
  const musicPlaying = useMusicPlayer((s) => s.isPlaying)
  const musicAccess  = useMusicPlayer((s) => s.access)

  const visibleModules = basicMode
    ? MODULES.filter(m => BASIC_MODE_ALLOWED_HREFS.has(m.href))
    : MODULES

  useEffect(() => {
    if (!profile?.business_id) return
    fetchQuickStats()

    // Realtime: auto-refresh when sales, products, or cash change
    const channel = supabase.channel('menu-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${profile.business_id}` }, () => fetchQuickStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${profile.business_id}` }, () => fetchQuickStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions', filter: `business_id=eq.${profile.business_id}` }, () => fetchQuickStats())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.business_id])

  async function fetchQuickStats() {
    if (!profile) return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [salesRes, lowStockRes, cajaRes] = await Promise.all([
      supabase
        .from('sales')
        .select('total')
        .eq('business_id', profile.business_id)
        .eq('voided', false)
        .gte('created_at', start),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', profile.business_id)
        .eq('active', true)
        .lte('stock', 5),
      supabase
        .from('cash_sessions')
        .select('id')
        .eq('business_id', profile.business_id)
        .eq('status', 'open')
        .limit(1),
    ])

    const todayData = salesRes.data ?? []
    setStats({
      todaySales: todayData.reduce((s: number, v: any) => s + v.total, 0),
      todayCount: todayData.length,
      lowStockCount: lowStockRes.count ?? 0,
      cajaOpen: (cajaRes.data?.length ?? 0) > 0,
    })
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Usuario'
  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // Attach lowStockCount badge to Productos; music badge if playing
  const modulesWithBadges = visibleModules.map((m) => ({
    ...m,
    badge:
      m.href === '/products' && stats?.lowStockCount
        ? stats.lowStockCount
        : m.href === '/music' && musicAccess.enabled && musicPlaying
          ? '♪'
          : undefined,
  }))

  return (
    <div className="animate-fade-in flex flex-col gap-3 sm:gap-3.5 max-w-275 mx-auto w-full">
      {/* ── Welcome header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 shrink-0">
        <div>
          <p className="text-[11px] text-white/35 capitalize">{today}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
            Hola, {firstName}
          </h1>
          {business?.name && (
            <p className="text-[12px] text-white/50 mt-0.5">{business.name}</p>
          )}
        </div>

        {/* Quick action: Nueva venta */}
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center gap-2 h-9 sm:h-10 px-4 sm:px-5 rounded-2xl gradient-primary text-white text-[13px] font-semibold shadow-lg shadow-green-900/30 hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva venta
        </button>
      </div>

      {/* ── Subscription status banner ── */}
      {business && (() => {
        const status = business.subscription_status
        const trialEnd = business.trial_ends_at ? new Date(business.trial_ends_at) : null
        const now = new Date()

        if (status === 'trial' && trialEnd) {
          const diffMs = trialEnd.getTime() - now.getTime()
          const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
          const isUrgent = daysLeft <= 2
          const isExpired = daysLeft === 0

          return (
            <div className={`glass-card p-2.5 sm:p-3 flex items-center gap-2.5 border shrink-0 ${
              isExpired
                ? 'border-red-500/25 bg-red-500/5'
                : isUrgent
                  ? 'border-amber-500/25 bg-amber-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isExpired ? 'bg-red-500/20' : isUrgent ? 'bg-amber-500/20' : 'bg-blue-500/20'
              }`}>
                <Clock className={`w-4 h-4 ${
                  isExpired ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-blue-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-bold ${
                  isExpired ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  {isExpired
                    ? 'Tu prueba gratuita terminó'
                    : `Prueba gratuita · ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} restantes`
                  }
                </p>
                <p className="text-[10px] text-white/40">
                  {isExpired
                    ? 'Activá tu suscripción para seguir usando STOCKIA'
                    : `Vence el ${trialEnd.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
                  }
                </p>
              </div>
              {!isExpired && (
                <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  isUrgent ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                }`}>
                  <Zap className="w-3 h-3" />
                  Trial
                </div>
              )}
            </div>
          )
        }

        if (status === 'active') {
          return (
            <div className="glass-card p-2.5 sm:p-3 flex items-center gap-2.5 border border-green-500/20 bg-green-500/5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-green-400">Plan Negocio · Activo</p>
                <p className="text-[10px] text-white/40">Suscripción mensual · $50.000/mes</p>
              </div>
              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-500/15 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Activo
              </div>
            </div>
          )
        }

        return null
      })()}

      {/* ── Quick KPI bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
        {/* Ventas hoy */}
        <div className="glass-card p-2.5 sm:p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40">Ventas hoy</p>
            {stats
              ? <p className="text-[14px] font-bold text-white leading-tight">{formatCurrency(stats.todaySales)}</p>
              : <div className="h-4 w-20 bg-white/10 rounded animate-pulse mt-0.5" />}
          </div>
        </div>

        {/* Transacciones */}
        <div className="glass-card p-2.5 sm:p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40">Transacciones</p>
            {stats
              ? <p className="text-[14px] font-bold text-white leading-tight">{stats.todayCount}</p>
              : <div className="h-4 w-10 bg-white/10 rounded animate-pulse mt-0.5" />}
          </div>
        </div>

        {/* Stock bajo */}
        <div
          className="glass-card p-2.5 sm:p-3 flex items-center gap-2.5 cursor-pointer hover:bg-white/10 transition"
          onClick={() => navigate('/products')}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stats?.lowStockCount ? 'bg-amber-500/20' : 'bg-slate-500/20'}`}>
            <AlertTriangle className={`w-4.5 h-4.5 ${stats?.lowStockCount ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40">Stock bajo</p>
            {stats
              ? <p className={`text-[14px] font-bold leading-tight ${stats.lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                  {stats.lowStockCount} prod.
                </p>
              : <div className="h-4 w-16 bg-white/10 rounded animate-pulse mt-0.5" />}
          </div>
        </div>

        {/* Caja */}
        <div
          className="glass-card p-2.5 sm:p-3 flex items-center gap-2.5 cursor-pointer hover:bg-white/10 transition"
          onClick={() => navigate('/cash-register')}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stats ? (stats.cajaOpen ? 'bg-green-500/20' : 'bg-red-500/20') : 'bg-slate-500/20'}`}>
            <Wallet className={`w-4.5 h-4.5 ${stats ? (stats.cajaOpen ? 'text-green-400' : 'text-red-400') : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40">Caja</p>
            {stats
              ? <p className={`text-[14px] font-bold leading-tight ${stats.cajaOpen ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.cajaOpen ? 'Abierta' : 'Cerrada'}
                </p>
              : <div className="h-4 w-14 bg-white/10 rounded animate-pulse mt-0.5" />}
          </div>
        </div>
      </div>

      {/* ── Module grid ── */}
      <div>
        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-1.5">Módulos</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
          {modulesWithBadges.map((mod, i) => (
            <ModuleTile
              key={mod.href}
              name={mod.name}
              href={mod.href}
              icon={mod.icon}
              color={mod.color}
              iconColor={mod.iconColor}
              description={mod.description}
              badge={mod.badge}
              shortcut={mod.shortcut}
              delay={i * 30}
            />
          ))}
        </div>
      </div>

      {/* ── Quick actions row ── */}
      <div className="glass-card px-2.5 py-2 flex items-center gap-2.5 shrink-0">
        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest hidden sm:block">Acciones</p>
        <div className="flex flex-wrap gap-1.5">
          <GlassButton size="sm" onClick={() => navigate('/pos')} className="text-white/80">
            <ShoppingCart className="w-3.5 h-3.5" />
            Nueva venta
          </GlassButton>
          <GlassButton size="sm" onClick={() => navigate('/cash-register')} className="text-white/80">
            <Wallet className="w-3.5 h-3.5" />
            {stats?.cajaOpen ? 'Ver caja' : 'Abrir caja'}
          </GlassButton>
          <GlassButton size="sm" onClick={() => navigate('/products')} className="text-white/80">
            <Package className="w-3.5 h-3.5" />
            Ir a productos
          </GlassButton>
          <GlassButton size="sm" onClick={() => navigate('/reports')} className="text-white/80">
            <TrendingUp className="w-3.5 h-3.5" />
            Ver reportes
          </GlassButton>
        </div>
      </div>


    </div>
  )
}

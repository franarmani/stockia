import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { supabase } from '@/lib/supabase'
import { useSubscription } from '@/features/subscription'
import { formatCurrency, cn } from '@/lib/utils'
import { SkeletonMetrics, SkeletonChart } from '@/components/ui/Skeleton'
import PaymentNotificationModal from '@/components/modals/PaymentNotificationModal'
import {
  ShoppingCart, Package, TrendingUp, DollarSign,
  AlertTriangle, ArrowRight, BarChart3, Wallet,
  Crown, Clock, ChevronRight,
} from 'lucide-react'

function useCountdown(deadline: Date, active: boolean) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline.getTime() - Date.now()))

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setRemainingMs(Math.max(0, deadline.getTime() - Date.now())), 1000)
    return () => clearInterval(id)
  }, [active, deadline.getTime()])

  const totalSeconds = Math.floor(remainingMs / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface QuickStats {
  todaySales: number
  todayCount: number
  averageTicket: number
  lowStockCount: number
  lowStockItems: { id: string; name: string; stock: number; stock_min: number }[]
  cajaOpen: boolean
}

export default function MenuLauncher() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const { planName, daysRemaining, isExpired, expiresToday, dateState, status } = useSubscription()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [weeklySales, setWeeklySales] = useState<number[]>([])
  const [lastSaleTime, setLastSaleTime] = useState<string | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const payDeadline = new Date(dateState.expirationDate.getTime() + 24 * 60 * 60 * 1000)
  const countdown = useCountdown(payDeadline, expiresToday)

  useEffect(() => {
    if (profile?.business_id) {
      fetchQuickStats()
      fetchWeeklySales()
      fetchLastActivity()
    }
  }, [profile?.business_id])

  async function fetchQuickStats() {
    if (!profile) return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [salesRes, lowStockRes, cajaRes] = await Promise.all([
      supabase.from('sales').select('total').eq('business_id', profile.business_id).gte('created_at', start),
      supabase.from('products').select('id, name, stock, stock_min').eq('business_id', profile.business_id).eq('active', true).lte('stock', 5).limit(5).order('stock'),
      supabase.from('cash_sessions').select('id').eq('business_id', profile.business_id).eq('status', 'open').limit(1),
    ])

    const todayData = salesRes.data ?? []
    const todaySales = todayData.reduce((s: number, v: any) => s + v.total, 0)
    const todayCount = todayData.length
    setStats({
      todaySales,
      todayCount,
      averageTicket: todayCount > 0 ? todaySales / todayCount : 0,
      lowStockCount: lowStockRes.data?.length ?? 0,
      lowStockItems: (lowStockRes.data ?? []) as any,
      cajaOpen: (cajaRes.data?.length ?? 0) > 0,
    })
  }

  async function fetchWeeklySales() {
    if (!profile) return
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('sales')
      .select('total, created_at')
      .eq('business_id', profile.business_id)
      .gte('created_at', sevenDaysAgo)
      .order('created_at')

    if (!data || data.length === 0) {
      setWeeklySales([])
      return
    }

    const days: number[] = Array(7).fill(0)
    for (const sale of data) {
      const saleDate = new Date(sale.created_at)
      const dayIndex = Math.floor((now.getTime() - saleDate.getTime()) / (24 * 60 * 60 * 1000))
      if (dayIndex >= 0 && dayIndex < 7) {
        days[6 - dayIndex] += sale.total
      }
    }
    setWeeklySales(days)
  }

  async function fetchLastActivity() {
    if (!profile) return
    const { data } = await supabase
      .from('sales')
      .select('created_at')
      .eq('business_id', profile.business_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const date = new Date(data.created_at)
      const now = new Date()
      const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
      if (diffMin < 1) setLastSaleTime('Ahora')
      else if (diffMin < 60) setLastSaleTime(`Hace ${diffMin} min`)
      else setLastSaleTime(`Hace ${Math.floor(diffMin / 60)}h`)
    }
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Usuario'
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const maxWeekly = Math.max(...weeklySales, 1)

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-white uppercase leading-none">
            Buenos días, {firstName}
          </h1>
          <p className="text-sm text-white/40 mt-2">{business?.name}</p>
          <p className="text-xs text-white/20 mt-0.5 capitalize">{today}</p>
        </div>
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
        >
          <ShoppingCart className="w-4 h-4" />
          Nueva venta
        </button>
      </div>

      {/* Tiempo de suscripción disponible */}
      {status !== 'cancelled' && (
        <div className={cn(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 border',
          expiresToday || isExpired ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/5 border-primary/20'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              expiresToday || isExpired ? 'bg-destructive/15' : 'bg-primary/10'
            )}>
              {expiresToday || isExpired
                ? <AlertTriangle className="w-5 h-5 text-destructive" />
                : <Clock className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isExpired
                  ? 'Tu suscripción está vencida'
                  : expiresToday
                    ? 'Tu suscripción vence hoy'
                    : `Te quedan ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} de suscripción`}
              </p>
              <p className="text-xs text-white/50">
                {isExpired
                  ? 'Regularizá el pago para reactivar tu cuenta.'
                  : expiresToday
                    ? 'Pagala ahora para no quedarte sin sistema.'
                    : `${planName} · Activo`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {expiresToday && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-destructive/20">
                <Clock className="w-3.5 h-3.5 text-destructive" />
                <span className="font-mono text-sm font-bold text-destructive tabular-nums">{countdown}</span>
              </div>
            )}
            {expiresToday || isExpired ? (
              <button
                onClick={() => setShowPayModal(true)}
                className="h-9 px-4 rounded-xl bg-destructive text-white text-xs font-bold hover:brightness-110 transition-all whitespace-nowrap"
              >
                Pagar ahora
              </button>
            ) : (
              <button
                onClick={() => navigate('/settings')}
                className="h-9 px-4 rounded-xl bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
              >
                Ver suscripción
              </button>
            )}
          </div>
        </div>
      )}

      {/* Metrics row */}
      {!stats ? (
        <SkeletonMetrics />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Ventas de hoy"
            value={formatCurrency(stats.todaySales)}
            icon={DollarSign}
            color="text-secondary"
            bg="bg-secondary/10"
            subtitle={`${stats.todayCount} operación${stats.todayCount !== 1 ? 'es' : ''}`}
          />
          <StatCard
            label="Operaciones"
            value={stats.todayCount.toString()}
            icon={TrendingUp}
            color="text-primary"
            bg="bg-primary/10"
          />
          <StatCard
            label="Ticket promedio"
            value={stats.todayCount > 0 ? formatCurrency(stats.averageTicket) : '...'}
            icon={BarChart3}
            color="text-secondary"
            bg="bg-secondary/10"
          />
          <StatCard
            label="Stock crítico"
            value={stats.lowStockCount.toString()}
            icon={Package}
            color={stats.lowStockCount > 0 ? 'text-destructive' : 'text-primary'}
            bg={stats.lowStockCount > 0 ? 'bg-destructive/10' : 'bg-primary/10'}
            subtitle={stats.lowStockCount > 0 ? 'productos por reponer' : 'sin novedades'}
            href="/products"
          />
        </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
        {/* Left: Weekly chart */}
        {!stats ? (
          <SkeletonChart />
        ) : (
        <div className="bg-surface border border-border rounded-2xl shadow-lg shadow-black/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Ventas últimos 7 días</h3>
              <p className="text-xs text-white/30 mt-0.5">Evolución diaria</p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-primary/60 hover:text-primary font-medium flex items-center gap-1"
            >
              Ver historial <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {weeklySales.length > 0 ? (
            <div className="flex items-end gap-2 h-32 pt-4">
              {weeklySales.map((value, i) => {
                const percent = maxWeekly > 0 ? (value / maxWeekly) * 100 : 0
                const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                const dayIndex = (new Date().getDay() - (6 - i) + 7) % 7
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full">
                    {/* Track */}
                    <div className="w-full flex-1 bg-white/5 rounded-t-md flex flex-col justify-end relative overflow-hidden">
                      {/* Bar */}
                      <div
                        className="w-full bg-primary/60 hover:bg-primary/80 transition-all rounded-t-md min-h-[4px]"
                        style={{ height: `${percent}%` }}
                      />
                    </div>
                    {/* Labels container with fixed height so they align at the bottom */}
                    <div className="flex flex-col items-center justify-start h-8 mt-2">
                      <span className="text-[9px] text-white/30 font-medium leading-none mb-1">{days[dayIndex]}</span>
                      {value > 0 ? (
                        <span className="text-[8px] text-white/50 font-bold leading-none font-mono tabular-nums">${value.toLocaleString('es-AR')}</span>
                      ) : (
                        <span className="text-[8px] text-transparent font-bold leading-none">-</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-white/20 text-sm">
              Sin ventas en los últimos 7 días
            </div>
          )}
        </div>
        )}

        {/* Right: Stock crítico */}
        <div className="bg-surface border border-border rounded-2xl shadow-lg shadow-black/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Stock crítico</h3>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-primary/60 hover:text-primary font-medium flex items-center gap-1"
            >
              Ver todo <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {stats && stats.lowStockItems.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                  <span className="text-[13px] font-medium text-white/70 truncate mr-2">{item.name}</span>
                  <span className={cn(
                    'text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0 font-mono tabular-nums',
                    item.stock === 0
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-secondary/20 text-secondary'
                  )}>
                    {item.stock} / {item.stock_min} {item.stock <= 1 ? 'un' : 'uds'}
                  </span>
                </div>
              ))}
              {stats.lowStockCount > 5 && (
                <button
                  onClick={() => navigate('/products')}
                  className="w-full text-center text-xs text-white/30 hover:text-white/60 py-2 font-medium"
                >
                  +{stats.lowStockCount - 5} productos más
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-white/20">
              <Package className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Inventario al día</p>
              <p className="text-xs mt-1">No hay productos con stock crítico</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Caja status */}
        <div className="bg-surface border border-border rounded-2xl shadow-lg shadow-black/20 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                stats?.cajaOpen ? 'bg-primary/10' : 'bg-destructive/10'
              )}>
                <Wallet className={cn(
                  'w-5 h-5',
                  stats?.cajaOpen ? 'text-primary' : 'text-destructive'
                )} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Caja</p>
                <p className={cn(
                  'text-xs font-medium',
                  stats?.cajaOpen ? 'text-primary' : 'text-destructive'
                )}>
                  {stats?.cajaOpen ? 'Abierta' : 'Cerrada'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/cash-register')}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white transition-all"
            >
              {stats?.cajaOpen ? 'Gestionar' : 'Abrir caja'}
            </button>
          </div>
        </div>

        {/* Subscription status */}
        <div className="bg-surface border border-border rounded-2xl shadow-lg shadow-black/20 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isExpired ? 'bg-destructive/10' : 'bg-primary/10'
              )}>
                <Crown className={cn(
                  'w-5 h-5',
                  isExpired ? 'text-destructive' : 'text-primary'
                )} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{planName}</p>
                <p className={cn(
                  'text-xs font-medium',
                  isExpired ? 'text-destructive' : 'text-white/40'
                )}>
                  {isExpired
                    ? 'Suscripción vencida'
                    : daysRemaining > 0
                      ? `${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} restantes`
                      : status === 'active' && !dateState.expiresToday
                        ? 'Activo'
                        : 'Vence hoy'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white transition-all"
            >
              Ver suscripción
            </button>
          </div>
        </div>
      </div>

      {/* Activity */}
      {lastSaleTime && (
        <div className="text-xs text-white/20 text-center">
          Última venta: {lastSaleTime}
        </div>
      )}

      {showPayModal && <PaymentNotificationModal daysLeft={0} onClose={() => setShowPayModal(false)} />}
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color, bg, subtitle, href,
}: {
  label: string
  value: string
  icon: any
  color: string
  bg: string
  subtitle?: string
  href?: string
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={href ? () => navigate(href) : undefined}
      className={cn(
        'bg-surface border border-border rounded-2xl shadow-lg shadow-black/20 p-4 min-w-0',
        href && 'cursor-pointer hover:border-white/10 transition-all'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[12px] font-medium text-white/40">{label}</p>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight font-mono tabular-nums truncate">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-white/30 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

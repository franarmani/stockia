import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalProducts } from '@/sync/storage'
import { cachedQuery, todayKey } from '@/sync/remote'
import { useSubscription } from '@/features/subscription'
import { formatCurrency, cn } from '@/lib/utils'
import { SkeletonMetrics, SkeletonChart } from '@/components/ui/Skeleton'
import PaymentNotificationModal from '@/components/modals/PaymentNotificationModal'
import WeatherWidget from '@/components/weather/WeatherWidget'
import {
  ShoppingCart, Package, TrendingUp, DollarSign,
  AlertTriangle, BarChart3, Wallet,
  ChevronRight, Receipt, Store,
  Calendar, CheckCircle2, Activity, CreditCard
} from 'lucide-react'

interface QuickStats {
  todaySales: number
  todayCount: number
  averageTicket: number
  lowStockCount: number
  cajaOpen: boolean
  cajaExpected: number
}

/** Importe corto para espacios chicos: $2,4 M · $780 k · $950. */
function compactMoney(value: number): string {
  const n = Math.round(value)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-AR')} k`
  return `$${n}`
}

export default function MenuLauncher() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const { planName, isExpired, expiresToday, status } = useSubscription()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [weeklySales, setWeeklySales] = useState<number[]>([])
  const [lastSaleTime, setLastSaleTime] = useState<string | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  useEffect(() => {
    if (!profile?.business_id) return
    const refresh = () => {
      fetchQuickStats().catch((error) => {
        console.error('[Inicio] no se pudieron cargar los indicadores', error)
        setStats(current => current ?? { todaySales: 0, todayCount: 0, averageTicket: 0, lowStockCount: 0, cajaOpen: false, cajaExpected: 0 })
      })
      fetchWeeklySales().catch((error) => {
        console.error('[Inicio] no se pudieron cargar las ventas de la semana', error)
        setWeeklySales([])
      })
      fetchLastActivity().catch(() => {})
    }
    refresh()
    return syncEngine.onSynced(refresh)
  }, [profile?.business_id])

  // Ventas del servidor (o las últimas guardadas sin conexión) + las hechas en este equipo sin sincronizar.
  async function salesSince(key: string, startISO: string): Promise<Array<{ total: number; created_at: string }>> {
    const businessId = profile!.business_id
    const [remote, pending] = await Promise.all([
      cachedQuery(key, supabase.from('sales').select('total, created_at').eq('business_id', businessId).gte('created_at', startISO).order('created_at')),
      syncEngine.getPendingSales(businessId),
    ])
    const local = pending.map(p => ({ total: p.sale.total, created_at: p.sale.created_at })).filter(s => s.created_at >= startISO)
    return [...((remote.data as any[]) ?? []), ...local]
  }

  async function fetchQuickStats() {
    if (!profile) return
    const businessId = profile.business_id
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [todayData, products, sessions] = await Promise.all([
      salesSince(`menu_sales_today:${businessId}:${todayKey()}`, start),
      getLocalProducts(businessId),
      syncEngine.pullRows<{ id: string; opening_amount: number; status: string }>('cash_sessions', businessId, () =>
        supabase.from('cash_sessions').select('*').eq('business_id', businessId)),
    ])

    const todaySales = todayData.reduce((s: number, v: any) => s + v.total, 0)
    const todayCount = todayData.length

    // Calculate cash in drawer
    const openSession = sessions.find(session => session.status === 'open') || null
    let cajaExpected = 0
    if (openSession) {
      const movements = await syncEngine.pullRows<any>('cash_movements', businessId, () =>
        supabase.from('cash_movements').select('*').eq('session_id', openSession.id))
      const movs = movements.filter((m: any) => m.session_id === openSession.id)
      const salesCash = movs.filter((m: any) => m.type === 'sale').reduce((s: number, m: any) => s + m.amount, 0)
      const income = movs.filter((m: any) => m.type === 'income').reduce((s: number, m: any) => s + m.amount, 0)
      const withdrawals = movs.filter((m: any) => m.type === 'withdrawal').reduce((s: number, m: any) => s + m.amount, 0)
      cajaExpected = (openSession.opening_amount || 0) + salesCash + income - withdrawals
    }

    setStats({
      todaySales,
      todayCount,
      averageTicket: todayCount > 0 ? todaySales / todayCount : 0,
      lowStockCount: products.filter(p => p.active !== false && p.stock <= 5).length,
      cajaOpen: !!openSession,
      cajaExpected,
    })
  }

  async function fetchWeeklySales() {
    if (!profile) return
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const data = await salesSince(`menu_sales_week:${profile.business_id}:${todayKey()}`, sevenDaysAgo)

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
    const [remote, pending] = await Promise.all([
      cachedQuery(`menu_last_sale:${profile.business_id}`, supabase
        .from('sales')
        .select('created_at')
        .eq('business_id', profile.business_id)
        .order('created_at', { ascending: false })
        .limit(1)),
      syncEngine.getPendingSales(profile.business_id),
    ])
    const latest = [...((remote.data as any[]) ?? []).map(s => s.created_at), ...pending.map(p => p.sale.created_at)].sort().pop()

    if (latest) {
      const date = new Date(latest)
      const now = new Date()
      const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
      if (diffMin < 1) setLastSaleTime('Ahora')
      else if (diffMin < 60) setLastSaleTime(`Hace ${diffMin} min`)
      else setLastSaleTime(`Hace ${Math.floor(diffMin / 60)}h`)
    }
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Usuario'
  const todayFormatted = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const maxWeekly = Math.max(...weeklySales, 1)
  const totalWeeklySales = weeklySales.reduce((acc, v) => acc + v, 0)

  // Dynamic greeting based on current hour
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="animate-fade-in space-y-6 max-w-7xl mx-auto">
      {/* ── 1. EXECUTIVE OPERATIONAL HEADER ── */}
      <div className="cg-card p-5 sm:p-7 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/50">{business?.name || 'Mi Comercio'}</p>
            <h1 className="cg-title mt-1">
              {greeting}, {firstName}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 mt-3 font-medium">
              <span className="flex items-center gap-1.5 capitalize text-white/60">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {todayFormatted}
              </span>
              {lastSaleTime && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Activity className="w-3.5 h-3.5" />
                    Última venta: {lastSaleTime}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Header Action Badges & Primary Action */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Cash Session Status Pill */}
            <button
              onClick={() => navigate('/cash-register')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                stats?.cajaOpen
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20'
              )}
            >
              <Wallet className="w-4 h-4" />
              <span>{stats?.cajaOpen ? 'Caja Abierta' : 'Caja Cerrada'}</span>
              {stats?.cajaOpen && stats.cajaExpected > 0 && (
                <span className="font-mono tabular-nums font-bold text-white pl-1 border-l border-emerald-500/30">
                  {formatCurrency(stats.cajaExpected)}
                </span>
              )}
            </button>

            {/* Primary POS Button */}
            <button
              onClick={() => navigate('/pos')}
              className="cg-btn-primary h-11 px-5 text-xs group"
            >
              <ShoppingCart className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Nueva Venta</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 font-mono">F1</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. EXECUTIVE 4-KPIs GRID ── */}
      {!stats ? (
        <SkeletonMetrics />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {/* KPI 1: Facturación de Hoy */}
          <div className="cg-card p-4 sm:p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all min-w-0">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[13px] font-medium text-white/55 truncate">
                Ventas de Hoy
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl 2xl:text-3xl font-semibold text-white tabular-nums tracking-tight truncate" title={formatCurrency(stats.todaySales)}>
              {formatCurrency(stats.todaySales)}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-white/50 font-medium truncate">
              <span className="text-emerald-400 font-bold">{stats.todayCount}</span>
              <span>operación{stats.todayCount !== 1 ? 'es' : ''} hoy</span>
            </div>
          </div>

          {/* KPI 2: Operaciones */}
          <div className="cg-card p-4 sm:p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all min-w-0">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[13px] font-medium text-white/55 truncate">
                Tickets Emitidos
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl 2xl:text-3xl font-semibold text-white tabular-nums tracking-tight truncate">
              {stats.todayCount}
            </p>
            <p className="text-xs text-white/50 font-medium mt-2 truncate">
              Comprobantes registrados
            </p>
          </div>

          {/* KPI 3: Ticket Promedio */}
          <div className="cg-card p-4 sm:p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all min-w-0">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[13px] font-medium text-white/55 truncate">
                Ticket Promedio
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl 2xl:text-3xl font-semibold text-white tabular-nums tracking-tight truncate" title={formatCurrency(stats.averageTicket)}>
              {formatCurrency(stats.averageTicket)}
            </p>
            <p className="text-xs text-white/50 font-medium mt-2 truncate">
              Rendimiento por venta
            </p>
          </div>

          {/* KPI 4: Stock Crítico / Alertas */}
          <div
            onClick={() => navigate('/products')}
            className="cg-card p-4 sm:p-5 relative overflow-hidden group hover:border-rose-500/30 cursor-pointer transition-all min-w-0"
          >
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[13px] font-medium text-white/55 truncate">
                Stock Crítico
              </span>
              <div className={cn(
                'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0',
                stats.lowStockCount > 0
                  ? 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                  : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
              )}>
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className={cn(
              "text-xl sm:text-2xl 2xl:text-3xl font-semibold tabular-nums tracking-tight truncate",
              stats.lowStockCount > 0 ? "text-rose-400" : "text-emerald-400"
            )}>
              {stats.lowStockCount}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-white/50 font-medium truncate">
                {stats.lowStockCount > 0 ? 'Artículos por reponer' : 'Inventario óptimo'}
              </span>
              <span className="text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center shrink-0">
                Ver <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. INVENTORY CRITICAL ALERT BANNER (If items are under minimum) ── */}
      {stats && stats.lowStockCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                Atención: Tenés {stats.lowStockCount} {stats.lowStockCount === 1 ? 'artículo en stock crítico o agotado' : 'artículos en stock crítico o agotados'}
              </p>
              <p className="text-xs text-rose-300/70 mt-0.5">
                Es recomendable reponer mercadería pronto para evitar faltantes en las ventas del mostrador.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-bold transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            Ver Inventario y Reponer →
          </button>
        </div>
      )}

      {/* ── 4. MAIN DASHBOARD ROW: 7-DAY SALES PERFORMANCE & LIVE WEATHER (Equal Height, Balanced Side-by-Side) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* 7 Days Sales Trend (60% width on desktop) */}
        <div className="xl:col-span-7 flex flex-col">
          {!stats ? (
            <SkeletonChart />
          ) : (
            <div className="cg-card p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Rendimiento de Ventas (Últimos 7 días)
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Facturación total acumulada: <span className="font-mono tabular-nums font-bold text-white">{formatCurrency(totalWeeklySales)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/reports')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors self-start sm:self-auto"
                  >
                    <span>Ver reportes completos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {weeklySales.length > 0 ? (
                <div className="flex items-end gap-1.5 sm:gap-3 flex-1 min-h-[190px] pt-4 pb-1">
                  {weeklySales.map((value, i) => {
                    const percent = maxWeekly > 0 ? (value / maxWeekly) * 100 : 0
                    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                    const dayIndex = (new Date().getDay() - (6 - i) + 7) % 7
                    const isCurrentDay = i === 6

                    return (
                      <div key={i} className="flex-1 min-w-0 flex flex-col items-center h-full group" title={`$${Math.round(value).toLocaleString('es-AR')}`}>
                        {/* Bar Track */}
                        <div className="w-full flex-1 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl flex flex-col justify-end relative overflow-hidden transition-colors p-1">
                          {/* Fill Bar */}
                          <div
                            className={cn(
                              'w-full transition-all duration-500 rounded-lg min-h-[6px]',
                              isCurrentDay
                                ? 'bg-primary'
                                : 'bg-primary/35 group-hover:bg-primary/55'
                            )}
                            style={{ height: `${Math.max(6, percent)}%` }}
                          />
                        </div>

                        {/* Labels */}
                        <div className="flex flex-col items-center justify-start h-10 mt-2">
                          <span className={cn(
                            'text-[10px] font-bold leading-none mb-1 uppercase tracking-wider',
                            isCurrentDay ? 'text-white' : 'text-white/40'
                          )}>
                            {days[dayIndex]}
                          </span>
                          {value > 0 ? (
                            <>
                              {/* En celular los importes van abreviados (2,4 M / 780 k) para que entren las 7 barras. */}
                              <span className="sm:hidden text-[10px] text-white/90 font-bold tabular-nums leading-none">{compactMoney(value)}</span>
                              <span className="hidden sm:inline text-[10px] text-white/90 font-bold font-mono tabular-nums leading-none">
                                ${Math.round(value).toLocaleString('es-AR')}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-white/20 font-bold leading-none">-</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 min-h-[190px] text-white/40 text-xs">
                  Sin ventas registradas en la última semana
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Weather Module (40% width on desktop) */}
        <div className="xl:col-span-5 flex flex-col">
          <WeatherWidget className="h-full" />
        </div>
      </div>

      {/* ── 5. ACCESOS RÁPIDOS & HERRAMIENTAS DE GESTIÓN (Full Width Ribbon) ── */}
      <div className="cg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Herramientas de Caja & Operación
            </h3>
          </div>
          <span className="text-[11px] text-white/40 font-medium hidden sm:inline">
            Accesos directos a módulos frecuentes
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Punto de Venta */}
          <button
            onClick={() => navigate('/pos')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-blue-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">F1</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
              Punto de Venta
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Nueva venta & cobro
            </span>
          </button>

          {/* Card 2: Control de Caja */}
          <button
            onClick={() => navigate('/cash-register')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-emerald-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">Arqueo</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
              Control de Caja
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Movimientos & cierres
            </span>
          </button>

          {/* Card 3: Productos & Stock */}
          <button
            onClick={() => navigate('/products')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-indigo-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">Stock</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
              Productos & Stock
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Catálogo & precios
            </span>
          </button>

          {/* Card 4: Historial de Ventas */}
          <button
            onClick={() => navigate('/sales')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-purple-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">Ventas</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
              Historial Ventas
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Tickets & comprobantes
            </span>
          </button>

          {/* Card 5: Comprobantes AFIP */}
          <button
            onClick={() => navigate('/comprobantes')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-sky-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">AFIP</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
              Comprobantes AFIP
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Facturas electrónicas
            </span>
          </button>

          {/* Card 6: Presupuestos */}
          <button
            onClick={() => navigate('/presupuestos')}
            className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-amber-500/30 text-left transition-all group hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">Cotizar</span>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
              Presupuestos
            </span>
            <span className="text-[10px] text-white/40 mt-0.5 truncate">
              Cotizaciones a clientes
            </span>
          </button>
        </div>
      </div>

      {showPayModal && <PaymentNotificationModal daysLeft={0} onClose={() => setShowPayModal(false)} />}
    </div>
  )
}

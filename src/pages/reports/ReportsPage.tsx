import { saveBlob } from '@/lib/saveFile'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { cachedRead, todayKey } from '@/sync/remote'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'
import MonthlyReportButton from '@/features/reports/MonthlyReportButton'
import { GlassButton } from '@/components/ui/GlassCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  TrendingUp, DollarSign, Package, CreditCard,
  Banknote, ArrowRightLeft, Download, Users,
  CircleDollarSign, AlertTriangle, User, BarChart3,
} from 'lucide-react'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', debit: 'Débito', credit: 'Crédito',
  transfer: 'Transfer.', account: 'Cta. Cte.', card: 'Tarjeta', mixed: 'Mixto',
}
const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote, debit: CreditCard, credit: CreditCard,
  transfer: ArrowRightLeft, account: CircleDollarSign, card: CreditCard,
}

// Trae todas las ventas del período en lotes de 1000 (límite por defecto de Supabase),
// sin el join pesado de product:products(*) (los productos ya están en la base local).
async function fetchAllSalesInBatches(businessId: string, startISO: string): Promise<any[]> {
  let allSales: any[] = []
  let from = 0
  const batchSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, business_id, total, payment_method, seller_id, customer_id, created_at, sale_items(product_id, quantity, price, cost_at_sale), seller:users!sales_seller_id_fkey(name), customer:customers(name)')
      .eq('business_id', businessId)
      .gte('created_at', startISO)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allSales = allSales.concat(data)
      hasMore = data.length === batchSize
      from += batchSize
    } else {
      hasMore = false
    }
  }

  return allSales
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const [sales, setSales] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [dormantProducts, setDormantProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.business_id) return
    fetchAll(false)
    const unsub = syncEngine.onSynced(() => {
      fetchAll(true)
    })
    return unsub
  }, [profile?.business_id, period])

  async function fetchAll(silent = false) {
    if (!silent && sales.length === 0) setLoading(true)
    const now = new Date()
    let start: string
    if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
    }
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString()

    // Con datos en la PC se muestra al instante (0ms) y se actualiza en segundo plano.
    const businessId = profile!.business_id
    try {
      const [report, products] = await Promise.all([
        cachedRead(`reports:${businessId}:${period}:${todayKey()}`, async () => {
          const earliest = start < thirtyDaysAgo ? start : thirtyDaysAgo
          const [fetchedSales, sellersRes] = await Promise.all([
            fetchAllSalesInBatches(businessId, earliest),
            supabase.from('users').select('id, name').eq('business_id', businessId),
          ])
          if (sellersRes.error) throw sellersRes.error
          const allSales = fetchedSales.filter((s: any) => s.created_at >= start)
          const soldIdsSet = new Set<string>()
          fetchedSales.forEach((s: any) => {
            if (s.created_at >= thirtyDaysAgo) {
              s.sale_items?.forEach((si: any) => {
                if (si.product_id) soldIdsSet.add(si.product_id)
              })
            }
          })
          return {
            sales: allSales,
            sellers: sellersRes.data || [],
            soldIds: Array.from(soldIdsSet),
          }
        }),
        syncEngine.pullLatestProducts(businessId),
      ])

      const productMap = new Map<string, any>()
      products.forEach((p: any) => productMap.set(p.id, p))

      const enrichedSales = (report.sales || []).map((s: any) => ({
        ...s,
        sale_items: s.sale_items?.map((i: any) => ({
          ...i,
          product: i.product || productMap.get(i.product_id) || null,
        })),
      }))

      setSales(enrichedSales)
      setSellers(report.sellers)
      const soldIds = new Set(report.soldIds)
      setDormantProducts(products.filter((p: any) => p.active !== false && !soldIds.has(p.id)).slice(0, 10))
    } catch (error: any) {
      if (!silent) toast.error(error?.message || 'No se pudieron cargar los reportes')
    } finally {
      setLoading(false)
    }
  }

  const totalSales = sales.reduce((s, sale) => s + sale.total, 0)
  const totalCost = sales.reduce((s, sale) => {
    return s + (sale.sale_items?.reduce((c: number, i: any) => c + (i.cost_at_sale || i.product?.purchase_price || 0) * i.quantity, 0) || 0)
  }, 0)
  const profit = totalSales - totalCost
  const marginPct = totalSales > 0 ? (profit / totalSales) * 100 : 0

  const paymentBreakdown = sales.reduce((acc: Record<string, number>, s) => {
    acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total; return acc
  }, {} as Record<string, number>)

  // Sales by seller
  const sellerBreakdown = (() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    sales.forEach((s) => {
      const name = s.seller?.name || 'Desconocido'
      if (!map[s.seller_id]) map[s.seller_id] = { name, total: 0, count: 0 }
      map[s.seller_id].total += s.total
      map[s.seller_id].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  // Sales by category
  const categoryBreakdown = (() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    sales.forEach((s) => {
      s.sale_items?.forEach((i: any) => {
        const catId = i.product?.category_id || 'sin-cat'
        const catName = 'General' // Categories aren't joined — we'll show product-level grouping
        if (!map[catId]) map[catId] = { name: catName, total: 0, count: 0 }
        map[catId].total += i.price * i.quantity
        map[catId].count += i.quantity
      })
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  })()

  // Top clients
  const topClients = (() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    sales.forEach((s) => {
      if (!s.customer_id) return
      const name = s.customer?.name || 'Cliente'
      if (!map[s.customer_id]) map[s.customer_id] = { name, total: 0, count: 0 }
      map[s.customer_id].total += s.total
      map[s.customer_id].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  })()

  const topProducts = (() => {
    const map: Record<string, { name: string; quantity: number; total: number; cost: number }> = {}
    sales.forEach((s) => {
      s.sale_items?.forEach((i: any) => {
        const id = i.product_id
        if (!map[id]) map[id] = { name: i.product?.name || 'Producto', quantity: 0, total: 0, cost: 0 }
        map[id].quantity += i.quantity; map[id].total += i.quantity * i.price
        map[id].cost += (i.cost_at_sale || i.product?.purchase_price || 0) * i.quantity
      })
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  })()

  const chartData = (() => {
    const map: Record<string, number> = {}
    sales.forEach((s) => {
      const d = new Date(s.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      map[d] = (map[d] || 0) + s.total
    })
    return Object.entries(map).reverse().map(([name, total]) => ({ name, total }))
  })()

  function exportCSV() {
    const rows = [['Fecha', 'Total', 'Método', 'Vendedor', 'Cliente', 'Productos']]
    sales.forEach((s) => {
      rows.push([
        new Date(s.created_at).toLocaleDateString('es-AR'),
        String(s.total),
        PAYMENT_LABELS[s.payment_method] || s.payment_method,
        s.seller?.name || '',
        s.customer?.name || 'Consumidor Final',
        s.sale_items?.map((i: any) => `${i.product?.name} x${i.quantity}`).join('; ') || '',
      ])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    saveBlob(blob, `ventas-${period}.csv`).catch(() => {})
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in flex flex-col gap-6 max-w-7xl mx-auto w-full px-2 sm:px-4 pb-16">

      {/* Executive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Módulo de Gestión
            </span>
            <span className="text-xs text-white/30">·</span>
            <span className="text-xs text-white/50 font-medium">Inteligencia Comercial</span>
          </div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)] mt-1.5">
            Reportes & Analítica
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-0.5">
            Evolución de ventas, márgenes brutos, métodos de cobro y rendimiento de equipo
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period pill switcher */}
          <div className="flex bg-[#0E1629] border border-white/[0.08] rounded-xl p-1 gap-1">
            <button 
              onClick={() => setPeriod('week')} 
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                period === 'week' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
              )}
            >
              Semana
            </button>
            <button 
              onClick={() => setPeriod('month')} 
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                period === 'month' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
              )}
            >
              Mes
            </button>
          </div>

          <button 
            onClick={exportCSV} 
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/80 transition-all active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-white/60" />
            <span>Exportar CSV</span>
          </button>
          <MonthlyReportButton />
        </div>
      </div>

      {/* Symmetric 4-Card KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Total Vendido */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Total Facturado</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {formatCurrency(totalSales)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold text-white/40">Monto total bruto del período</span>
            </div>
          </div>
        </div>

        {/* Ganancia Estimada */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Margen Bruto Est.</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono tabular-nums tracking-tight">
              {formatCurrency(profit)}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {marginPct.toFixed(1)}% Margen
              </span>
            </div>
          </div>
        </div>

        {/* Operaciones */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Operaciones</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {sales.length}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold text-white/40">Ventas registradas y sincronizadas</span>
            </div>
          </div>
        </div>

        {/* Clientes Únicos */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Clientes Únicos</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {new Set(sales.filter(s => s.customer_id).map(s => s.customer_id)).size}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold text-white/40">Clientes identificados en el período</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B1120]/80 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Rendimiento Temporal</p>
              <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">Evolución de Ventas Diarias</h2>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fontWeight: 600, fill: 'rgba(255,255,255,0.35)' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
                />
                <YAxis 
                  tick={{ fontSize: 11, fontWeight: 600, fill: 'rgba(255,255,255,0.35)' }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(14, 22, 41, 0.95)', 
                    borderRadius: '14px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    backdropFilter: 'blur(10px)',
                    padding: '10px 14px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                  }} 
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}
                  itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}
                  formatter={(value) => [formatCurrency(Number(value))]} 
                />
                <Bar 
                  dataKey="total" 
                  fill="#f97316" 
                  radius={[8, 8, 2, 2]} 
                  barSize={window.innerWidth < 640 ? 18 : 28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Product Card */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B1120]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Rankings</p>
                <h2 className="text-base font-bold text-white tracking-tight mt-0.5">Top Productos Más Vendidos</h2>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/50 border border-white/[0.06]">
                <Package className="w-4 h-4" />
              </div>
            </div>

            {topProducts.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">Sin datos suficientes en el período</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3.5 py-3 hover:bg-white/[0.02] transition-colors rounded-xl px-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border transition-transform",
                      i === 0 ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {p.quantity} unid. vendidas · Gan: {formatCurrency(p.total - p.cost)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-white font-mono tabular-nums">{formatCurrency(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B1120]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Medios de Cobro</p>
                <h2 className="text-base font-bold text-white tracking-tight mt-0.5">Distribución por Método</h2>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/50 border border-white/[0.06]">
                <Banknote className="w-4 h-4" />
              </div>
            </div>

            {Object.keys(paymentBreakdown).length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">Sin datos registrados en el período</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                  const pct = totalSales > 0 ? (amount / totalSales) * 100 : 0
                  const Icon = PAYMENT_ICONS[method] || ArrowRightLeft
                  return (
                    <div key={method} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white tracking-tight">{PAYMENT_LABELS[method] || method}</p>
                            <p className="text-[10px] text-white/40">{pct.toFixed(1)}% del total</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-white font-mono tabular-nums">{formatCurrency(amount)}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sellers Breakdown */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B1120]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Equipo de Ventas</p>
                <h2 className="text-base font-bold text-white tracking-tight mt-0.5">Ventas por Vendedor</h2>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/50 border border-white/[0.06]">
                <User className="w-4 h-4" />
              </div>
            </div>

            {sellerBreakdown.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">Sin transacciones registradas</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {sellerBreakdown.map((s, i) => (
                  <div key={i} className="flex items-center gap-3.5 py-3 hover:bg-white/[0.02] transition-colors rounded-xl px-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{s.count} transacciones realizadas</p>
                    </div>
                    <span className="text-xs font-bold text-white font-mono tabular-nums">{formatCurrency(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dormant Products Alert */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B1120]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Atención de Stock</p>
                <h2 className="text-base font-bold text-white tracking-tight mt-0.5">Productos Estancados</h2>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {dormantProducts.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">Excelente: todo el inventario tiene rotación en los últimos 30 días</div>
            ) : (
              <div className="space-y-2">
                {dormantProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-amber-500/25 transition-all">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-amber-400/80 mt-0.5">{p.stock} unidades sin movimiento (30 días)</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs font-bold text-white/70 font-mono tabular-nums">{formatCurrency(p.sale_price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

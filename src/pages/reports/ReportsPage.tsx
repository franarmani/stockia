import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'
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

export default function ReportsPage() {
  const { profile } = useAuthStore()
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const [sales, setSales] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [dormantProducts, setDormantProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.business_id) fetchAll() }, [profile?.business_id, period])

  async function fetchAll() {
    setLoading(true)
    const now = new Date()
    let start: string
    if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else {
      start = new Date(now.getTime() - 7 * 86400000).toISOString()
    }
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

    const [salesRes, sellersRes, dormantRes] = await Promise.all([
      supabase.from('sales').select('*, sale_items(*, product:products(*)), seller:users!sales_seller_id_fkey(name), customer:customers(name)')
        .eq('business_id', profile!.business_id).gte('created_at', start).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name').eq('business_id', profile!.business_id),
      // Products with no sale items in 30 days
      supabase.from('products').select('id, name, stock, sale_price').eq('business_id', profile!.business_id).eq('active', true),
    ])

    setSales(salesRes.data || [])
    setSellers(sellersRes.data || [])

    // Find dormant products (no sales in 30 days)
    const { data: recentSaleItems } = await supabase
      .from('sale_items').select('product_id, sale:sales!inner(created_at, business_id)')
      .gte('sale.created_at', thirtyDaysAgo).eq('sale.business_id', profile!.business_id)
    const soldIds = new Set((recentSaleItems || []).map((si: any) => si.product_id))
    setDormantProducts((dormantRes.data || []).filter((p: any) => !soldIds.has(p.id)).slice(0, 10))

    setLoading(false)
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
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ventas-${period}.csv`
    a.click()
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-black">Inteligencia</p>
          <h1 className="text-3xl font-black text-white mt-1 tracking-tight">Reportes</h1>
          <div className="flex items-center gap-2 mt-1">
             <BarChart3 className="w-3.5 h-3.5 text-orange-500/50" />
             <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{sales.length} ventas en el período</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:justify-end">
          <div className="flex bg-white/[0.03] border border-white/5 rounded-2xl p-1 gap-1">
            <button 
              onClick={() => setPeriod('week')} 
              className={cn(
                "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                period === 'week' ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/50"
              )}
            >
              Semana
            </button>
            <button 
              onClick={() => setPeriod('month')} 
              className={cn(
                "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                period === 'month' ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/50"
              )}
            >
              Mes
            </button>
          </div>
          <GlassButton size="sm" onClick={exportCSV} className="bg-white/5">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </GlassButton>
        </div>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-1">
        <div className="bg-orange-500 rounded-[2rem] p-6 text-slate-950 relative overflow-hidden group shadow-xl shadow-orange-500/20 col-span-2 lg:col-span-1">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Total Vendido</p>
          <p className="text-3xl font-black tracking-tighter">{formatCurrency(totalSales)}</p>
          <div className="mt-4 flex items-center gap-2">
             <div className="px-2 py-0.5 rounded-lg bg-black/10 text-[9px] font-black uppercase tracking-widest">Bruto</div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-20 h-20 text-emerald-400" />
          </div>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-1">Ganancia Estimada</p>
          <p className="text-2xl font-black text-emerald-400 tracking-tighter">{formatCurrency(profit)}</p>
          <div className="mt-2 flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
             <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Margen {marginPct.toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <Package className="w-20 h-20 text-blue-400" />
          </div>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-1">Op. Realizadas</p>
          <p className="text-2xl font-black text-white tracking-tighter">{sales.length}</p>
          <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-2 px-2 py-0.5 rounded-lg border border-white/5 inline-block">Sincronizado</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <Users className="w-20 h-20 text-violet-400" />
          </div>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-1">Clientes Únicos</p>
          <p className="text-2xl font-black text-white tracking-tighter">
            {new Set(sales.filter(s => s.customer_id).map(s => s.customer_id)).size}
          </p>
          <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-2">En el período</p>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="px-1">
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Rendimiento Temporal</p>
                <h2 className="text-xl font-black text-white tracking-tight mt-1">Evolución de Ventas</h2>
              </div>
              <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                 <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
            </div>
            
            <div className="h-64 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.2)' }} 
                    axisLine={false} 
                    tickLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.2)' }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderRadius: '20px', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    }} 
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                    itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 900 }}
                    formatter={(value) => [formatCurrency(Number(value))]} 
                  />
                  <Bar 
                    dataKey="total" 
                    fill="#f97316" 
                    radius={[12, 12, 4, 4]} 
                    barSize={window.innerWidth < 640 ? 20 : 35}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1">
        {/* Top Product Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-6 pb-2">
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Rankings</p>
            <h2 className="text-base font-black text-white tracking-tight mt-1">Top Productos</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-12 text-white/10 italic text-sm">Sin datos suficientes</div>
          ) : (
            <div className="divide-y divide-white/[0.02] mt-4">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-all group">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border border-white/5 transition-transform group-hover:scale-110",
                    i === 0 ? "bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/20" : "bg-white/5 text-white/40"
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white truncate leading-tight transition-colors group-hover:text-orange-400">{p.name}</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">
                      {p.quantity} uds sold · Gan: {formatCurrency(p.total - p.cost)}
                    </p>
                  </div>
                  <span className="text-sm font-black text-white tracking-tight">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 lg:p-8">
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-4">Medios de Pago</p>
          {Object.keys(paymentBreakdown).length === 0 ? (
            <div className="text-center py-12 text-white/10 italic text-sm">Sin datos suficientes</div>
          ) : (
            <div className="space-y-6 mt-6">
              {Object.entries(paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                const pct = totalSales > 0 ? (amount / totalSales) * 100 : 0
                const Icon = PAYMENT_ICONS[method] || ArrowRightLeft
                return (
                  <div key={method} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 transition-all">
                           <Icon className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-black text-white tracking-tight leading-none">{PAYMENT_LABELS[method] || method}</p>
                           <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.1em] mt-1">{pct.toFixed(1)}% del total</p>
                        </div>
                      </div>
                      <span className="text-base font-black text-white tracking-tight">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-1000 group-hover:bg-white group-hover:shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sellers Breakdown */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-6 pb-2">
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Rendimiento Equipo</p>
            <h2 className="text-base font-black text-white tracking-tight mt-1">Ventas por Vendedor</h2>
          </div>
          {sellerBreakdown.length === 0 ? (
            <div className="text-center py-12 text-white/10 italic text-sm">Sin datos registrados</div>
          ) : (
            <div className="divide-y divide-white/[0.02] mt-4">
              {sellerBreakdown.map((s, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-all group">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white truncate leading-tight">{s.name}</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">{s.count} transacciones</p>
                  </div>
                  <span className="text-sm font-black text-white tracking-tight">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dormant Products Alert */}
        {dormantProducts.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] p-6 lg:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
               <AlertTriangle className="w-20 h-20 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
               </div>
               <div>
                  <h2 className="text-base font-black text-white tracking-tight leading-none">Productos Estancados</h2>
                  <p className="text-[10px] text-amber-500/60 font-black uppercase tracking-[0.1em] mt-1">Sin movimiento en 30 días</p>
               </div>
            </div>
            
            <div className="space-y-3">
              {dormantProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 rounded-2xl bg-black/20 border border-white/5 hover:border-amber-500/30 transition-all">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{p.name}</p>
                    <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-0.5">{p.stock} en stock físico</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[11px] font-black text-white/50">{formatCurrency(p.sale_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

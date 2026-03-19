import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  TrendingUp, DollarSign, Package, CreditCard,
  Banknote, ArrowRightLeft, Download, Users,
  CircleDollarSign, AlertTriangle, User,
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
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Reportes</h1>
          <p className="text-[13px] text-muted-foreground">{sales.length} ventas en el período</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setPeriod('week')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${period === 'week' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}>Semana</button>
            <button onClick={() => setPeriod('month')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${period === 'month' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}>Mes</button>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Big stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="gradient-primary rounded-2xl p-4 text-white col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="w-4 h-4 opacity-70" />
            <span className="text-[11px] font-medium opacity-70">Vendido</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-[11px] font-medium text-muted-foreground">Ganancia</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(profit)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Margen {marginPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-medium text-muted-foreground">Ventas</span>
          </div>
          <p className="text-xl font-bold">{sales.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 text-violet-600" />
            <span className="text-[11px] font-medium text-muted-foreground">Clientes</span>
          </div>
          <p className="text-xl font-bold">{new Set(sales.filter(s => s.customer_id).map(s => s.customer_id)).size}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-sm text-foreground mb-3">Ventas por día</h2>
          <div className="h-48 sm:h-60">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Total']} contentStyle={{ borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }} />
                <Bar dataKey="total" fill="#1DB954" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-foreground">Top productos</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.quantity} uds — Gan: {formatCurrency(p.total - p.cost)}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-foreground">Medios de pago</h2>
          </div>
          {Object.keys(paymentBreakdown).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="p-4 space-y-3">
              {Object.entries(paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                const pct = totalSales > 0 ? (amount / totalSales) * 100 : 0
                const Icon = PAYMENT_ICONS[method] || ArrowRightLeft
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{PAYMENT_LABELS[method] || method}</span>
                      </div>
                      <span className="font-bold">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{pct.toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-foreground">Ventas por vendedor</h2>
          </div>
          {sellerBreakdown.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sellerBreakdown.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.count} ventas</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-foreground">Mejores clientes</h2>
          </div>
          {topClients.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.count} compras</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dormant products */}
      {dormantProducts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-foreground">Productos sin movimiento (30 días)</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {dormantProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.stock} en stock</p>
                </div>
                <span className="text-sm font-bold text-muted-foreground shrink-0">{formatCurrency(p.sale_price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Plus,
  Wallet,
  Percent,
  Package,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Product } from '@/types/database'
import { UNIT_SHORT, type ProductUnit } from '@/types/database'
import { isDecimalUnit } from '@/stores/posStore'
import Button from '@/components/ui/Button'

interface DashboardData {
  todaySales: number
  todayCount: number
  todayCost: number
  todayMargin: number
  avgTicket: number
  lowStockProducts: Product[]
  chartData: { name: string; ventas: number }[]
  cajaOpen: boolean
  cajaExpected: number
  stockValue: number
}

interface DolarRate {
  casa: string
  nombre: string
  compra: number
  venta: number
}

const DOLAR_LABELS: Record<string, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  bolsa: 'Bolsa (MEP)',
  contadoliqui: 'CCL',
  tarjeta: 'Tarjeta',
  mayorista: 'Mayorista',
  cripto: 'Cripto',
}

export default function DashboardPage() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dolarRates, setDolarRates] = useState<DolarRate[]>([])
  const [selectedDolar, setSelectedDolar] = useState<string>('blue')
  const [dolarLoading, setDolarLoading] = useState(false)
  const [dolarUpdatedAt, setDolarUpdatedAt] = useState<Date | null>(null)
  const [showDolarPicker, setShowDolarPicker] = useState(false)
  const dolarPickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!showDolarPicker) return
    const handler = (e: MouseEvent) => {
      if (dolarPickerRef.current && !dolarPickerRef.current.contains(e.target as Node)) {
        setShowDolarPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDolarPicker])

  const fetchDolarRates = useCallback(async () => {
    setDolarLoading(true)
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares')
      if (!res.ok) throw new Error('API error')
      const json: DolarRate[] = await res.json()
      setDolarRates(json)
      setDolarUpdatedAt(new Date())
    } catch {
      // silently fail — no USD shown if offline/API down
    } finally {
      setDolarLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDolarRates()
  }, [])

  useEffect(() => {
    if (!profile?.business_id) return
    fetchDashboard()

    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${profile.business_id}` }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${profile.business_id}` }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions', filter: `business_id=eq.${profile.business_id}` }, () => fetchDashboard())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.business_id])

  async function fetchDashboard() {
    if (!profile) return
    const businessId = profile.business_id
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const startOfWeek = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()).toISOString()

    const [salesTodayRes, salesWeekRes, lowStockRes, cashRes, salesDetailRes, allProductsRes] = await Promise.all([
      supabase.from('sales').select('total').eq('business_id', businessId).eq('voided', false).gte('created_at', startOfDay),
      supabase.from('sales').select('total, created_at').eq('business_id', businessId).eq('voided', false).gte('created_at', startOfWeek),
      supabase.from('products').select('*').eq('business_id', businessId).eq('active', true).lte('stock', 5).order('stock', { ascending: true }).limit(8),
      supabase.from('cash_sessions').select('*, cash_movements(*)').eq('business_id', businessId).eq('status', 'open').limit(1),
      supabase.from('sales').select('*, sale_items(quantity, price, product:products(purchase_price))').eq('business_id', businessId).eq('voided', false).gte('created_at', startOfDay),
      supabase.from('products').select('sale_price, stock').eq('business_id', businessId).eq('active', true).gt('stock', 0),
    ])

    const todayData = salesTodayRes.data || []
    const weekData = salesWeekRes.data || []
    const todaySales = todayData.reduce((s: number, v: any) => s + v.total, 0)

    // Calculate real cost from sale_items
    const salesWithItems = salesDetailRes.data || []
    const todayCost = salesWithItems.reduce((total: number, sale: any) => {
      return total + (sale.sale_items || []).reduce((c: number, item: any) => {
        return c + (item.product?.purchase_price || 0) * item.quantity
      }, 0)
    }, 0)
    const todayMargin = todaySales > 0 ? ((todaySales - todayCost) / todaySales) * 100 : 0

    // Cash register status
    const openSession = (cashRes.data && cashRes.data.length > 0) ? cashRes.data[0] : null
    let cajaExpected = 0
    if (openSession) {
      const movs: any[] = openSession.cash_movements || []
      const salesTotal = movs.filter((m: any) => m.type === 'sale').reduce((s: number, m: any) => s + m.amount, 0)
      const incomeTotal = movs.filter((m: any) => m.type === 'income').reduce((s: number, m: any) => s + m.amount, 0)
      const withdrawals = movs.filter((m: any) => m.type === 'withdrawal').reduce((s: number, m: any) => s + m.amount, 0)
      cajaExpected = (openSession.opening_amount || 0) + salesTotal + incomeTotal - withdrawals
    }

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const chartEntries: { name: string; ventas: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      const dayTotal = weekData
        .filter((s: any) => { const sd = new Date(s.created_at); return sd >= dayStart && sd < dayEnd })
        .reduce((sum: number, s: any) => sum + s.total, 0)
      chartEntries.push({ name: dayNames[d.getDay()], ventas: dayTotal })
    }

    const lowStockProducts = (lowStockRes.data || []).filter((p: any) => p.stock <= p.stock_min)

    const stockValue = (allProductsRes.data || []).reduce((sum: number, p: any) => sum + (p.sale_price || 0) * (p.stock || 0), 0)

    setData({
      todaySales,
      todayCount: todayData.length,
      todayCost,
      todayMargin,
      avgTicket: todayData.length > 0 ? todaySales / todayData.length : 0,
      lowStockProducts,
      chartData: chartEntries,
      cajaOpen: !!openSession,
      cajaExpected,
      stockValue,
    })
    setLoading(false)
  }

  if (loading) return <LoadingSpinner />
  if (!data) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Hola, {profile?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground text-[13px]">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button onClick={() => navigate('/pos')}>
          <Plus className="w-3.5 h-3.5" />
          Nueva venta
        </Button>
      </div>

      {/* Revenue card */}
      <div className="gradient-primary rounded-2xl overflow-hidden relative p-6">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-white/60 text-xs font-medium mb-1">Facturación hoy</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {formatCurrency(data.todaySales)}
            </p>
            {data.todayCount > 0 && (
              <p className="text-white/50 text-[12px] mt-1.5">
                {data.todayCount} venta{data.todayCount !== 1 && 's'} · Ganancia: {formatCurrency(data.todaySales - data.todayCost)}
              </p>
            )}
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <DollarSign className="w-7 h-7 text-white/80" />
          </div>
        </div>
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/[0.04] rounded-full" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ventas</p>
              <p className="text-lg font-bold">{data.todayCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ticket prom.</p>
              <p className="text-lg font-bold">{formatCurrency(data.avgTicket)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Margen</p>
              <p className="text-lg font-bold">{data.todayMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer" onClick={() => navigate('/cash-register')}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${data.cajaOpen ? 'bg-green-100' : 'bg-red-100'}`}>
              <Wallet className={`w-5 h-5 ${data.cajaOpen ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{data.cajaOpen ? 'Caja' : 'Caja cerrada'}</p>
              <p className="text-lg font-bold">{data.cajaOpen ? formatCurrency(data.cajaExpected) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stock value card */}
      {(() => {
        const rate = dolarRates.find(r => r.casa === selectedDolar)
        const usdValue = rate && rate.venta > 0 ? data.stockValue / rate.venta : null
        return (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Valor total en stock</p>
                  <p
                    className="text-xl font-bold text-foreground cursor-pointer hover:text-emerald-700 transition-colors"
                    onClick={() => navigate('/products')}
                  >
                    {formatCurrency(data.stockValue)}
                  </p>
                  {usdValue !== null ? (
                    <p className="text-sm font-semibold text-emerald-600 mt-0.5">
                      ≈ U$D {usdValue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  ) : dolarRates.length === 0 && !dolarLoading ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sin cotización disponible</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground mt-1">Precio de venta × unidades disponibles</p>
                </div>
              </div>

              {/* Dollar selector */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="relative" ref={dolarPickerRef}>
                  <button
                    onClick={() => setShowDolarPicker(v => !v)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2 py-1 transition-colors"
                  >
                    <span>$ {DOLAR_LABELS[selectedDolar] ?? selectedDolar}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showDolarPicker && (
                    <div className="absolute right-0 top-full mt-1 border border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-32.5" style={{ backgroundColor: '#0b1a44' }}>
                      {dolarRates.map(r => (
                        <button
                          key={r.casa}
                          onClick={() => { setSelectedDolar(r.casa); setShowDolarPicker(false) }}
                          className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-white/10 transition-colors flex items-center justify-between gap-2 ${
                            r.casa === selectedDolar ? 'font-semibold text-emerald-400' : 'text-white/80'
                          }`}
                        >
                          <span>{DOLAR_LABELS[r.casa] ?? r.nombre}</span>
                          <span className="text-white/45 tabular-nums">${r.venta.toLocaleString('es-AR')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {rate && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Venta: ${rate.venta.toLocaleString('es-AR')}
                  </p>
                )}
                <button
                  onClick={fetchDolarRates}
                  disabled={dolarLoading}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  title="Actualizar cotización"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dolarLoading ? 'animate-spin' : ''}`} />
                </button>
                {dolarUpdatedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {dolarUpdatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Low stock */}
      {data.lowStockProducts.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-semibold text-foreground">Stock bajo</span>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-primary hover:text-primary-dark font-semibold flex items-center gap-0.5 transition-colors"
            >
              Ver todo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.lowStockProducts.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                <span className="text-[13px] text-foreground truncate mr-2">{p.name}</span>
                <Badge variant={p.stock === 0 ? 'destructive' : 'warning'}>
                  {isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock} {UNIT_SHORT[(p.unit || 'u') as ProductUnit]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Últimos 7 días</p>
        {data.chartData.some(d => d.ventas > 0) ? (
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), 'Ventas']}
                contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="ventas" fill="#1DB954" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Sin ventas esta semana
          </div>
        )}
      </div>
    </div>
  )
}

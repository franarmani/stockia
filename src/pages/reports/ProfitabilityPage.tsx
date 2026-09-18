import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fetchAllProductsInBatches } from '@/lib/productService'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { GlassButton } from '@/components/ui/GlassCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import {
  TrendingUp, DollarSign, Package, Download,
  Layers, Search, Calendar, Tag, Truck, RefreshCw, BarChart3,
  Percent, ArrowUpDown, Sparkles, Filter, ChevronRight, Check
} from 'lucide-react'
import type { Product, Category, Supplier } from '@/types/database'

type PeriodPreset = 'today' | '7days' | 'month' | '30days' | 'year' | 'all' | 'custom'
type ViewMode = 'products' | 'materials' | 'categories'
type SortField = 'name' | 'material' | 'category' | 'soldQty' | 'revenue' | 'cost' | 'profit' | 'margin' | 'stock' | 'stockCost'
type SortOrder = 'asc' | 'desc'

interface ProductProfitRow {
  id: string
  name: string
  barcode: string | null
  material: string
  category: string
  brand: string
  stock: number
  unit: string
  purchasePrice: number
  salePrice: number
  soldQty: number
  revenue: number
  cost: number
  profit: number
  margin: number
  markup: number
  stockCost: number
  stockValue: number
  stockPotentialProfit: number
}

interface GroupedRow {
  groupKey: string
  productsCount: number
  soldQty: number
  revenue: number
  cost: number
  profit: number
  margin: number
  stock: number
  stockCost: number
  stockValue: number
}

export default function ProfitabilityPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  // Data states
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [period, setPeriod] = useState<PeriodPreset>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [search, setSearch] = useState('')

  // View & Sorting
  const [viewMode, setViewMode] = useState<ViewMode>('products')
  const [sortField, setSortField] = useState<SortField>('profit')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    if (profile?.business_id) {
      loadAllData()
    }
  }, [profile?.business_id, period, customStart, customEnd])

  // Get date limits based on preset
  function getDateLimits(): { startISO?: string; endISO?: string } {
    const now = new Date()
    let start: Date | null = null
    let end: Date | null = null

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === '7days') {
      start = new Date(now.getTime() - 7 * 86400000)
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === '30days') {
      start = new Date(now.getTime() - 30 * 86400000)
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1)
    } else if (period === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00')
      if (customEnd) end = new Date(customEnd + 'T23:59:59')
    }

    return {
      startISO: start ? start.toISOString() : undefined,
      endISO: end ? end.toISOString() : undefined,
    }
  }

  async function loadAllData() {
    setLoading(true)
    try {
      const bizId = profile!.business_id
      const { startISO, endISO } = getDateLimits()

      // Fetch products, categories, suppliers
      const [prods, catsRes, supsRes] = await Promise.all([
        fetchAllProductsInBatches(bizId),
        supabase.from('categories').select('*').eq('business_id', bizId).order('name'),
        supabase.from('suppliers').select('*').eq('business_id', bizId).eq('active', true).order('name'),
      ])

      // Fetch sales in period in batches of 1000
      let allSales: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('sales')
          .select('id, created_at, total, sale_items(product_id, quantity, price, cost_at_sale)')
          .eq('business_id', bizId)
          .order('created_at', { ascending: false })

        if (startISO) query = query.gte('created_at', startISO)
        if (endISO) query = query.lte('created_at', endISO)

        const { data, error } = await query.range(from, from + batchSize - 1)
        if (error) throw error

        if (data && data.length > 0) {
          allSales = allSales.concat(data)
          hasMore = data.length === batchSize
          from += batchSize
        } else {
          hasMore = false
        }
      }

      setProducts(prods || [])
      setCategories(catsRes.data || [])
      setSuppliers(supsRes.data || [])
      setSales(allSales)
    } catch (err) {
      console.error('Error fetching profitability data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Extract distinct materials and brands from products
  const availableMaterials = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.material && p.material.trim()) set.add(p.material.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [products])

  const availableBrands = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [products])

  // Category map for rapid lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => map.set(c.id, c.name))
    return map
  }, [categories])

  // Map of sales aggregated by product_id for the selected period
  const salesByProduct = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number; cost: number }>()

    sales.forEach((sale) => {
      const items = sale.sale_items || []
      items.forEach((item: any) => {
        const pId = item.product_id
        if (!pId) return
        const qty = Number(item.quantity) || 0
        const price = Number(item.price) || 0
        const costUnit = Number(item.cost_at_sale) || 0

        const cur = map.get(pId) || { qty: 0, revenue: 0, cost: 0 }
        cur.qty += qty
        cur.revenue += qty * price
        cur.cost += qty * costUnit
        map.set(pId, cur)
      })
    })

    return map
  }, [sales])

  // Full product-level profit rows
  const productProfitRows = useMemo<ProductProfitRow[]>(() => {
    return products.map((p) => {
      const saleStats = salesByProduct.get(p.id) || { qty: 0, revenue: 0, cost: 0 }
      const unitCost = p.avg_cost || p.purchase_price || 0
      const salePrice = p.sale_price || 0

      // If cost_at_sale was missing from sale_items, fall back to product cost
      const actualCost = saleStats.cost > 0 ? saleStats.cost : saleStats.qty * unitCost
      const profit = saleStats.revenue - actualCost
      const margin = saleStats.revenue > 0 ? (profit / saleStats.revenue) * 100 : 0
      const markup = actualCost > 0 ? (profit / actualCost) * 100 : 0

      const stockCost = p.stock * unitCost
      const stockValue = p.stock * salePrice
      const stockPotentialProfit = stockValue - stockCost

      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        material: p.material?.trim() || 'Sin material',
        category: p.category_id ? categoryMap.get(p.category_id) || 'Sin categoría' : 'Sin categoría',
        brand: p.brand?.trim() || 'Sin marca',
        stock: p.stock,
        unit: p.unit || 'u',
        purchasePrice: unitCost,
        salePrice: salePrice,
        soldQty: saleStats.qty,
        revenue: saleStats.revenue,
        cost: actualCost,
        profit: profit,
        margin: margin,
        markup: markup,
        stockCost: stockCost,
        stockValue: stockValue,
        stockPotentialProfit: stockPotentialProfit,
      }
    })
  }, [products, salesByProduct, categoryMap])

  // Filtered rows according to active filters
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return productProfitRows.filter((row) => {
      // Text search
      if (q) {
        const matchesName = row.name.toLowerCase().includes(q)
        const matchesBarcode = row.barcode ? row.barcode.toLowerCase().includes(q) : false
        const matchesBrand = row.brand.toLowerCase().includes(q)
        const matchesMaterial = row.material.toLowerCase().includes(q)
        if (!matchesName && !matchesBarcode && !matchesBrand && !matchesMaterial) return false
      }

      // Material filter
      if (filterMaterial) {
        if (filterMaterial === '__none__') {
          if (row.material !== 'Sin material') return false
        } else if (row.material.toLowerCase() !== filterMaterial.toLowerCase()) {
          return false
        }
      }

      // Category filter
      if (filterCategory) {
        const prod = products.find((p) => p.id === row.id)
        if (!prod || prod.category_id !== filterCategory) return false
      }

      // Brand filter
      if (filterBrand && row.brand.toLowerCase() !== filterBrand.toLowerCase()) {
        return false
      }

      // Supplier filter
      if (filterSupplier) {
        const prod = products.find((p) => p.id === row.id)
        if (!prod || prod.supplier_id !== filterSupplier) return false
      }

      return true
    })
  }, [productProfitRows, search, filterMaterial, filterCategory, filterBrand, filterSupplier, products])

  // Grouped by Material
  const groupedByMaterial = useMemo<GroupedRow[]>(() => {
    const map = new Map<string, GroupedRow>()

    filteredRows.forEach((row) => {
      const key = row.material
      const cur = map.get(key) || {
        groupKey: key,
        productsCount: 0,
        soldQty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        stock: 0,
        stockCost: 0,
        stockValue: 0,
      }

      cur.productsCount += 1
      cur.soldQty += row.soldQty
      cur.revenue += row.revenue
      cur.cost += row.cost
      cur.profit += row.profit
      cur.stock += row.stock
      cur.stockCost += row.stockCost
      cur.stockValue += row.stockValue
      map.set(key, cur)
    })

    return Array.from(map.values()).map((g) => ({
      ...g,
      margin: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
    }))
  }, [filteredRows])

  // Grouped by Category
  const groupedByCategory = useMemo<GroupedRow[]>(() => {
    const map = new Map<string, GroupedRow>()

    filteredRows.forEach((row) => {
      const key = row.category
      const cur = map.get(key) || {
        groupKey: key,
        productsCount: 0,
        soldQty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        stock: 0,
        stockCost: 0,
        stockValue: 0,
      }

      cur.productsCount += 1
      cur.soldQty += row.soldQty
      cur.revenue += row.revenue
      cur.cost += row.cost
      cur.profit += row.profit
      cur.stock += row.stock
      cur.stockCost += row.stockCost
      cur.stockValue += row.stockValue
      map.set(key, cur)
    })

    return Array.from(map.values()).map((g) => ({
      ...g,
      margin: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
    }))
  }, [filteredRows])

  // Aggregate global KPIs based on filtered items
  const totals = useMemo(() => {
    let totalRevenue = 0
    let totalCost = 0
    let totalProfit = 0
    let totalSoldUnits = 0
    let totalStockUnits = 0
    let totalStockCost = 0
    let totalStockValue = 0

    filteredRows.forEach((r) => {
      totalRevenue += r.revenue
      totalCost += r.cost
      totalProfit += r.profit
      totalSoldUnits += r.soldQty
      totalStockUnits += r.stock
      totalStockCost += r.stockCost
      totalStockValue += r.stockValue
    })

    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const overallMarkup = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    const potentialStockProfit = totalStockValue - totalStockCost

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      margin: overallMargin,
      markup: overallMarkup,
      soldUnits: totalSoldUnits,
      stockUnits: totalStockUnits,
      stockCost: totalStockCost,
      stockValue: totalStockValue,
      potentialStockProfit: potentialStockProfit,
    }
  }, [filteredRows])

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Sorted product rows
  const sortedProductRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: any = a[sortField as keyof ProductProfitRow]
      let valB: any = b[sortField as keyof ProductProfitRow]
      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB, 'es', { sensitivity: 'base' })
        return sortOrder === 'asc' ? comp : -comp
      }
      valA = Number(valA) || 0
      valB = Number(valB) || 0
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [filteredRows, sortField, sortOrder])

  // Sorted grouped rows
  const sortedGroupedRows = useMemo(() => {
    const list = viewMode === 'materials' ? groupedByMaterial : groupedByCategory
    return [...list].sort((a, b) => {
      let valA: any
      let valB: any

      if (sortField === 'name' || sortField === 'material' || sortField === 'category') {
        valA = a.groupKey
        valB = b.groupKey
        const comp = valA.localeCompare(valB, 'es', { sensitivity: 'base' })
        return sortOrder === 'asc' ? comp : -comp
      }

      if (sortField === 'soldQty') { valA = a.soldQty; valB = b.soldQty }
      else if (sortField === 'revenue') { valA = a.revenue; valB = b.revenue }
      else if (sortField === 'cost') { valA = a.cost; valB = b.cost }
      else if (sortField === 'margin') { valA = a.margin; valB = b.margin }
      else if (sortField === 'stock') { valA = a.stock; valB = b.stock }
      else if (sortField === 'stockCost') { valA = a.stockCost; valB = b.stockCost }
      else { valA = a.profit; valB = b.profit }

      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [viewMode, groupedByMaterial, groupedByCategory, sortField, sortOrder])

  // Chart data: Top materials / categories by profit
  const chartData = useMemo(() => {
    const source = viewMode === 'categories' ? groupedByCategory : groupedByMaterial
    return [...source]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6)
      .map((item) => ({
        name: item.groupKey,
        Ganancia: Math.max(0, Math.round(item.profit)),
        Costo: Math.round(item.cost),
        Ventas: Math.round(item.revenue),
      }))
  }, [viewMode, groupedByMaterial, groupedByCategory])

  // Export CSV
  function handleExportCSV() {
    let headers: string[]
    let rows: (string | number)[][]

    if (viewMode === 'products') {
      headers = [
        'Producto', 'Material', 'Categoría', 'Marca', 'Stock Actual', 'Uds Vendidas',
        'Costo Unitario', 'Precio Venta', 'Facturación Total', 'Costo Total',
        'Ganancia Neta', 'Margen %', 'Markup %', 'Costo Inmovilizado Stock', 'Valor Venta Stock'
      ]
      rows = sortedProductRows.map((r) => [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.material}"`,
        `"${r.category}"`,
        `"${r.brand}"`,
        r.stock,
        r.soldQty,
        r.purchasePrice.toFixed(2),
        r.salePrice.toFixed(2),
        r.revenue.toFixed(2),
        r.cost.toFixed(2),
        r.profit.toFixed(2),
        r.margin.toFixed(2) + '%',
        r.markup.toFixed(2) + '%',
        r.stockCost.toFixed(2),
        r.stockValue.toFixed(2),
      ])
    } else {
      const groupTitle = viewMode === 'materials' ? 'Material' : 'Categoría'
      headers = [
        groupTitle, 'Cant. Productos', 'Uds Vendidas', 'Facturación Total',
        'Costo Total', 'Ganancia Neta', 'Margen %', 'Stock Total', 'Costo Stock', 'Valor Venta Stock'
      ]
      rows = sortedGroupedRows.map((g) => [
        `"${g.groupKey}"`,
        g.productsCount,
        g.soldQty,
        g.revenue.toFixed(2),
        g.cost.toFixed(2),
        g.profit.toFixed(2),
        g.margin.toFixed(2) + '%',
        g.stock,
        g.stockCost.toFixed(2),
        g.stockValue.toFixed(2),
      ])
    }

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rentabilidad_${viewMode}_${period}.csv`
    link.click()
  }

  // Margin color helper
  function getMarginBadgeClass(margin: number) {
    if (margin >= 40) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (margin >= 20) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    if (margin > 0) return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    return 'text-red-400 bg-red-500/10 border-red-500/20'
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Navigation tabs header */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-4 px-1">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <BarChart3 className="w-4 h-4 text-orange-400" />
          Ventas Generales
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Costos, Ganancias y Rentabilidad
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-cyan-400 uppercase tracking-widest font-black flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Control Financiero
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight flex items-center gap-3">
            Rentabilidad y Costos
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Análisis profundo de costos de adquisición, ingresos, ganancias reales y valorización de inventario por material y categorías.
          </p>
        </div>

        {/* Top Actions: Period Presets & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-white/[0.03] border border-white/10 rounded-2xl p-1 gap-1">
            {(
              [
                { id: 'today', label: 'Hoy' },
                { id: '7days', label: '7D' },
                { id: 'month', label: 'Mes' },
                { id: '30days', label: '30D' },
                { id: 'year', label: 'Año' },
                { id: 'all', label: 'Histórico' },
                { id: 'custom', label: 'Personalizado' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all',
                  period === p.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <GlassButton size="sm" onClick={handleExportCSV} className="bg-white/5 hover:bg-white/10 text-white">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={() => {
              setRefreshing(true)
              loadAllData()
            }}
            disabled={refreshing}
            className="bg-white/5"
            title="Recargar datos"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
          </GlassButton>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black uppercase text-white/50">Desde:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black uppercase text-white/50">Hasta:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-xl shadow-black/20 flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por producto, código o variante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all"
          />
        </div>

        {/* Filter Material */}
        <div className="flex-1 sm:max-w-[220px]">
          <select
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-white/10 bg-slate-900/90 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 cursor-pointer"
          >
            <option value="">Todos los materiales</option>
            <option value="__none__">Sin material asignado</option>
            {availableMaterials.map((m) => (
              <option key={m} value={m}>
                Material: {m}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Category */}
        <div className="flex-1 sm:max-w-[200px]">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-white/10 bg-slate-900/90 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Brand */}
        {availableBrands.length > 0 && (
          <div className="flex-1 sm:max-w-[180px]">
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-slate-900/90 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 cursor-pointer"
            >
              <option value="">Todas las marcas</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Supplier */}
        {suppliers.length > 0 && (
          <div className="flex-1 sm:max-w-[180px]">
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-slate-900/90 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 cursor-pointer"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset button if any filter is set */}
        {(filterMaterial || filterCategory || filterBrand || filterSupplier || search) && (
          <button
            onClick={() => {
              setFilterMaterial('')
              setFilterCategory('')
              setFilterBrand('')
              setFilterSupplier('')
              setSearch('')
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-semibold whitespace-nowrap transition-all"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Bento Grid: Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
        {/* Ganancia Neta Card (Hero) */}
        <div className="bg-gradient-to-br from-emerald-600/30 to-emerald-950/40 border border-emerald-500/30 rounded-[2rem] p-6 relative overflow-hidden group shadow-xl shadow-emerald-900/20 col-span-2 sm:col-span-1">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform text-emerald-400">
            <TrendingUp className="w-28 h-28" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-emerald-300/70">Ganancia Neta Real</p>
          <p className="text-3xl sm:text-4xl font-black text-emerald-300 tracking-tighter">
            {formatCurrency(totals.profit)}
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-200">
              Margen {totals.margin.toFixed(1)}%
            </span>
            <span className="text-[10px] text-emerald-200/60 font-semibold">
              Markup {totals.markup.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Facturación Total Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <DollarSign className="w-24 h-24 text-cyan-400" />
          </div>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Ventas Totales</p>
          <p className="text-3xl font-black text-white tracking-tighter">
            {formatCurrency(totals.revenue)}
          </p>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-4">
            {totals.soldUnits} unidades vendidas
          </p>
        </div>

        {/* Costo de Ventas (COGS) Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <Tag className="w-24 h-24 text-orange-400" />
          </div>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Costo de Mercadería Vendida</p>
          <p className="text-3xl font-black text-orange-400/90 tracking-tighter">
            {formatCurrency(totals.cost)}
          </p>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-4">
            {totals.revenue > 0 ? ((totals.cost / totals.revenue) * 100).toFixed(1) : 0}% de la venta
          </p>
        </div>

        {/* Valorización de Stock Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
            <Package className="w-24 h-24 text-violet-400" />
          </div>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Stock Inmovilizado</p>
          <p className="text-2xl font-black text-white tracking-tighter">
            {formatCurrency(totals.stockCost)}
          </p>
          <div className="mt-3 flex flex-col gap-0.5 text-[10px] text-white/40">
            <span>Venta proyectada: {formatCurrency(totals.stockValue)}</span>
            <span className="text-emerald-400 font-bold">
              Ganancia potencial: {formatCurrency(totals.potentialStockProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Section: Ganancia vs Costo */}
      {chartData.length > 0 && (
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Rendimiento Comparativo</p>
              <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
                Ventas, Costos y Ganancias por {viewMode === 'categories' ? 'Categoría' : 'Material'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/40 font-medium">Visualizando:</span>
              <div className="flex bg-black/30 border border-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setViewMode('materials')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition',
                    viewMode === 'materials' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white'
                  )}
                >
                  Materiales
                </button>
                <button
                  onClick={() => setViewMode('categories')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition',
                    viewMode === 'categories' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white'
                  )}
                >
                  Categorías
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontWeight: 700, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.3)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    padding: '12px 16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  }}
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-white/60 font-bold ml-1">{value}</span>}
                />
                <Bar dataKey="Ventas" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Costo" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Ganancia" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdown View Tabs & Detailed Table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/40">
        {/* Table header and view mode tabs */}
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Desglose Analítico</p>
            <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
              {viewMode === 'products'
                ? 'Rendimiento por Producto Individual'
                : viewMode === 'materials'
                ? 'Rendimiento Consolidado por Material'
                : 'Rendimiento Consolidado por Categoría'}
            </h2>
          </div>

          <div className="flex bg-black/40 border border-white/10 rounded-2xl p-1 gap-1 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('products')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                viewMode === 'products'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-white/40 hover:text-white'
              )}
            >
              Por Producto ({filteredRows.length})
            </button>
            <button
              onClick={() => setViewMode('materials')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                viewMode === 'materials'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-white/40 hover:text-white'
              )}
            >
              Por Material ({groupedByMaterial.length})
            </button>
            <button
              onClick={() => setViewMode('categories')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                viewMode === 'categories'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-white/40 hover:text-white'
              )}
            >
              Por Categoría ({groupedByCategory.length})
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {viewMode === 'products' ? (
            <table className="w-full text-left text-xs text-white">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-white/40 uppercase tracking-widest font-black select-none">
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Producto <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('material')}>
                    <div className="flex items-center gap-1">Material <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('category')}>
                    <div className="flex items-center gap-1">Categoría <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('stock')}>
                    <div className="flex items-center justify-end gap-1">Stock <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('soldQty')}>
                    <div className="flex items-center justify-end gap-1">Vendidos <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Costo Unit.</th>
                  <th className="py-3.5 px-4 text-right">Precio Vta.</th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('revenue')}>
                    <div className="flex items-center justify-end gap-1">Facturado <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('cost')}>
                    <div className="flex items-center justify-end gap-1">Costo Total <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('profit')}>
                    <div className="flex items-center justify-end gap-1">Ganancia <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('margin')}>
                    <div className="flex items-center justify-end gap-1">Margen % <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {sortedProductRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-white/20 italic">
                      No se encontraron productos con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  sortedProductRows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/products/${r.id}`)}
                      className="hover:bg-white/[0.02] transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold">
                        <div className="flex items-center gap-2">
                          <span className="group-hover:text-cyan-300 transition-colors">{r.name}</span>
                          {r.brand && r.brand !== 'Sin marca' && (
                            <span className="text-[9px] text-white/30 uppercase">({r.brand})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {r.material !== 'Sin material' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-300">
                            {r.material}
                          </span>
                        ) : (
                          <span className="text-white/20 text-[10px] italic">Sin material</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-white/50">{r.category}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-white/70">
                        {r.stock} {r.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {r.soldQty}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white/40">
                        {formatCurrency(r.purchasePrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white/70">
                        {formatCurrency(r.salePrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {formatCurrency(r.revenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-orange-400/80">
                        {formatCurrency(r.cost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        {formatCurrency(r.profit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-black', getMarginBadgeClass(r.margin))}>
                          {r.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-white">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-white/40 uppercase tracking-widest font-black select-none">
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      {viewMode === 'materials' ? 'Material' : 'Categoría'} <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">Variedad Productos</th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('stock')}>
                    <div className="flex items-center justify-end gap-1">Stock Físico <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('soldQty')}>
                    <div className="flex items-center justify-end gap-1">Uds Vendidas <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('revenue')}>
                    <div className="flex items-center justify-end gap-1">Facturación Total <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('cost')}>
                    <div className="flex items-center justify-end gap-1">Costo Total <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('profit')}>
                    <div className="flex items-center justify-end gap-1">Ganancia Neta <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('margin')}>
                    <div className="flex items-center justify-end gap-1">Margen Promedio <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 text-right" onClick={() => handleSort('stockCost')}>
                    <div className="flex items-center justify-end gap-1">Costo Inmovilizado <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {sortedGroupedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-white/20 italic">
                      Sin datos agrupados registrados
                    </td>
                  </tr>
                ) : (
                  sortedGroupedRows.map((g) => (
                    <tr key={g.groupKey} className="hover:bg-white/[0.02] transition">
                      <td className="py-4 px-4 font-black">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                          <span className="text-sm text-white">{g.groupKey}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-white/50">
                        {g.productsCount} ítem{g.productsCount !== 1 ? 's' : ''}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-white/60">
                        {g.stock}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-white">
                        {g.soldQty}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-cyan-300">
                        {formatCurrency(g.revenue)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-orange-400">
                        {formatCurrency(g.cost)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                        {formatCurrency(g.profit)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={cn('px-2.5 py-1 rounded-md border text-xs font-black', getMarginBadgeClass(g.margin))}>
                          {g.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-white/40">
                        {formatCurrency(g.stockCost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

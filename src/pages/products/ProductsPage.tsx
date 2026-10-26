import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalProducts } from '@/sync/storage'
import { usePlan } from '@/hooks/usePlan'
import ImagePicker from '@/features/onlineStore/ImagePicker'
import { removeStoreImage } from '@/features/onlineStore/storeImages'
import { BASIC_LIMITS } from '@/config/plans'
import { withSyncNote } from '@/sync/connectivity'
import BulkPriceModal from '@/features/products/BulkPriceModal'
import LabelPrintModal from '@/features/products/LabelPrintModal'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { isDecimalUnit } from '@/stores/posStore'
import { UNIT_SHORT, UNIT_LABELS, type ProductUnit } from '@/types/database'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { GlassCard, GlassPanel, GlassButton } from '@/components/ui/GlassCard'
import ImportProductsModal from '@/components/ImportProductsModal'
import ExportProductsModal from '@/components/ExportProductsModal'
import type { Product, Category, Supplier } from '@/types/database'
import {
  Search, Plus, Package, AlertTriangle,
  Barcode, MinusCircle, PlusCircle, Edit3, Trash2,
  Tag, X, Truck, Upload, Download, Layers,
  Zap, ChevronRight
} from 'lucide-react'

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: 'u', label: 'Unidad (u)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'mts', label: 'Metro (mts)' },
  { value: 'lts', label: 'Litro (lts)' },
]

export default function ProductsPage() {
  const navigate = useNavigate()
  const { isPremium } = usePlan()
  const premiumOnly = (open: () => void) => () => {
    if (isPremium) return open()
    toast.info('Importar, aumentos masivos y etiquetas están en el plan Premium')
    navigate('/settings?tab=subscription')
  }
  const { profile } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showBulkUnitsModal, setShowBulkUnitsModal] = useState(false)
  const [bulkUnitsQty, setBulkUnitsQty] = useState('10')
  const [bulkConfirmed, setBulkConfirmed] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockAdjustment, setStockAdjustment] = useState(0)
  const [stockReason, setStockReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', barcode: '', sale_price: '', purchase_price: '',
    stock: '', stock_min: '3', category_id: '', unit: 'u' as string,
    brand: '', size_label: '', model: '', presentation: '', supplier_id: '',
    material: '',
    show_online: true,
    image_url: null as string | null,
  })
  const [catForm, setCatForm] = useState({ name: '' })
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', cuit: '' })

  useEffect(() => {
    if (!profile?.business_id) return
    fetchAll()
    return syncEngine.onSynced(() => { fetchAll() })
  }, [profile?.business_id])

  // Primero la base local (instantánea y sin conexión), después lo que haya en el servidor.
  async function fetchAll() {
    const businessId = profile!.business_id
    const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    try {
      await syncEngine.init()
      const local = await getLocalProducts(businessId)
      if (local.length > 0) {
        setProducts(byName(local as Product[]))
        setLoading(false)
      }
      const [prods, cats, sups] = await Promise.all([
        syncEngine.pullLatestProducts(businessId),
        syncEngine.pullRows<Category>('categories', businessId, () =>
          supabase.from('categories').select('*').eq('business_id', businessId).order('name')),
        syncEngine.pullRows<Supplier>('suppliers', businessId, () =>
          supabase.from('suppliers').select('*').eq('business_id', businessId)),
      ])
      setProducts(byName(prods.filter(p => p.active !== false) as Product[]))
      setCategories(byName(cats))
      setSuppliers(byName(sups.filter(s => s.active !== false)))
    } catch (error) {
      console.error('[Products] Error loading data:', error)
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const materials = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => {
      if (p.material && p.material.trim()) set.add(p.material.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [products])

  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false)

  const totalInventoryValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stock * (p.purchase_price || p.avg_cost || 0)), 0)
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch = !search || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) || (p.model && p.model.toLowerCase().includes(q)) ||
        (p.material && p.material.toLowerCase().includes(q))
      const matchCat = !filterCategory || p.category_id === filterCategory
      const matchMat = !filterMaterial || (p.material && p.material.trim().toLowerCase() === filterMaterial.toLowerCase())
      const matchLowStock = !filterLowStockOnly || p.stock <= p.stock_min
      return matchSearch && matchCat && matchMat && matchLowStock
    })
  }, [products, search, filterCategory, filterMaterial, filterLowStockOnly])

  const visibleProducts = useMemo(() => filtered.slice(0, 30), [filtered])

  // Selección múltiple para edición masiva
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const selectedProducts = useMemo(() => products.filter(p => selected.has(p.id)), [products, selected])
  const [bulkBusy, setBulkBusy] = useState(false)
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(p => p.id)))
  }

  async function handleBulkCase(mode: 'upper' | 'lower' | 'title') {
    const label = mode === 'upper' ? 'MAYÚSCULAS' : mode === 'lower' ? 'minúsculas' : 'Cada Palabra Con Mayúscula'
    const toChange = products
      .filter(p => selected.has(p.id))
      .map(p => {
        const lower = p.name.toLocaleLowerCase('es')
        const name = mode === 'upper' ? p.name.toLocaleUpperCase('es')
          : mode === 'lower' ? lower
          : lower.replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toLocaleUpperCase('es'))
        return { id: p.id, name }
      })
      .filter(u => u.name !== products.find(p => p.id === u.id)!.name)
    if (toChange.length === 0) { toast.info('No hay nombres para cambiar'); return }
    if (!confirm(`¿Pasar ${toChange.length} nombres a ${label}?`)) return
    setBulkBusy(true)
    try {
      for (const u of toChange) {
        await syncEngine.updateRow('products', profile!.business_id, u.id, { name: u.name })
      }
      toast.success(withSyncNote(`${toChange.length} nombres actualizados`))
    } catch {
      toast.error('No se pudieron guardar todos los cambios')
    }
    setBulkBusy(false)
    fetchAll()
  }

  async function handleBulkCategory() {
    if (!bulkCategory) { toast.error('Elegí una categoría'); return }
    const ids = Array.from(selected)
    const catName = bulkCategory === '__none__' ? 'Sin categoría' : categories.find(c => c.id === bulkCategory)?.name
    if (!confirm(`¿Pasar ${ids.length} productos a "${catName}"?`)) return
    setBulkBusy(true)
    try {
      await syncEngine.updateRows('products', profile!.business_id, ids, { category_id: bulkCategory === '__none__' ? null : bulkCategory })
      toast.success(withSyncNote(`${ids.length} productos pasados a "${catName}"`))
    } catch {
      toast.error('Algunos productos no se pudieron actualizar')
    }
    setBulkBusy(false)
    setBulkCategory('')
    fetchAll()
  }

  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.stock_min), [products])

  async function openNew() {
    if (!isPremium && (await getLocalProducts(profile!.business_id)).length >= BASIC_LIMITS.products) {
      toast.error(`El plan Básico permite hasta ${BASIC_LIMITS.products} productos. Pasate a Premium para cargar sin límite.`)
      return
    }
    setEditingProduct(null)
    setForm({ name: '', barcode: '', sale_price: '', purchase_price: '', stock: '', stock_min: '3', category_id: '', unit: 'u', brand: '', size_label: '', model: '', presentation: '', supplier_id: '', material: '', show_online: true, image_url: null })
    setShowProductModal(true)
  }
  function openEdit(p: Product) {
    setEditingProduct(p)
    setForm({
      name: p.name, barcode: p.barcode || '', sale_price: String(p.sale_price), purchase_price: String(p.purchase_price),
      stock: String(p.stock), stock_min: String(p.stock_min), category_id: p.category_id || '',
      unit: p.unit || 'u', brand: p.brand || '', size_label: p.size_label || '',
      model: p.model || '', presentation: p.presentation || '', supplier_id: p.supplier_id || '',
      material: p.material || '',
      show_online: (p as any).show_online !== false,
      image_url: p.image_url ?? null,
    })
    setShowProductModal(true)
  }

  async function handleSaveProduct() {
    if (!form.name || !form.sale_price) { toast.error('Nombre y precio son obligatorios'); return }
    setSaving(true)
    const payload = {
      business_id: profile!.business_id,
      name: form.name, barcode: form.barcode || null,
      sale_price: Number(form.sale_price), purchase_price: Number(form.purchase_price) || 0,
      stock: Number(form.stock) || 0, stock_min: Number(form.stock_min) || 3,
      category_id: form.category_id || null,
      unit: form.unit || 'u',
      brand: form.brand || null,
      size_label: form.size_label || null,
      model: form.model || null,
      presentation: form.presentation || null,
      supplier_id: form.supplier_id || null,
      avg_cost: Number(form.purchase_price) || 0,
      material: form.material.trim() || null,
      show_online: form.show_online,
      image_url: form.image_url,
    }
    const businessId = profile!.business_id
    try {
      if (editingProduct) {
        // El stock no se pisa con un valor absoluto: la diferencia se registra como ajuste,
        // así no se pierden ventas hechas desde otra caja mientras tanto.
        const { stock, business_id: _businessId, ...fields } = payload
        await syncEngine.updateRow('products', businessId, editingProduct.id, fields)
        const delta = Math.round((stock - editingProduct.stock) * 1000) / 1000
        if (delta !== 0) await syncEngine.adjustStock(businessId, editingProduct.id, delta, 'adjustment', 'Edición de producto')
        if (editingProduct.image_url && editingProduct.image_url !== form.image_url) removeStoreImage(editingProduct.image_url).catch(() => {})
        toast.success(withSyncNote('Producto actualizado'))
      } else {
        await syncEngine.createRow('products', businessId, {
          ...payload,
          id: crypto.randomUUID(),
          active: true,
          created_at: new Date().toISOString(),
        })
        toast.success(withSyncNote('Producto creado'))
      }
      setShowProductModal(false)
      fetchAll()
    } catch (error) {
      console.error('[Products] save failed:', error)
      toast.error(editingProduct ? 'Error al actualizar' : 'Error al crear')
    }
    setSaving(false)
  }

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar ${p.name}?`)) return
    await syncEngine.updateRow('products', profile!.business_id, p.id, { active: false })
    toast.success(withSyncNote('Producto eliminado')); fetchAll()
  }

  async function handleQuickStock(product: Product, delta: number) {
    const newStock = Math.max(0, Math.round((product.stock + delta) * 1000) / 1000)
    await syncEngine.adjustStock(profile!.business_id, product.id, delta, delta > 0 ? 'purchase' : 'adjustment')
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p))
  }

  function openStockModal(p: Product) { setStockProduct(p); setStockAdjustment(0); setStockReason(''); setShowStockModal(true) }

  async function handleStockAdjust() {
    if (!stockProduct || stockAdjustment === 0) return
    setSaving(true)
    await syncEngine.adjustStock(profile!.business_id, stockProduct.id, stockAdjustment, stockAdjustment > 0 ? 'purchase' : 'adjustment', stockReason)
    toast.success(withSyncNote('Stock actualizado')); setShowStockModal(false); setSaving(false); fetchAll()
  }

  async function handleBulkAddUnits() {
    const qty = Number(bulkUnitsQty)
    if (!qty || qty <= 0) { toast.error('Ingresá una cantidad válida'); return }
    setBulkSaving(true)
    let errorCount = 0
    for (const p of products) {
      try {
        await syncEngine.adjustStock(profile!.business_id, p.id, qty, 'adjustment', `Ajuste masivo: +${qty} unidades`)
      } catch {
        errorCount++
      }
    }
    setBulkSaving(false)
    setShowBulkUnitsModal(false)
    setBulkConfirmed(false)
    if (errorCount > 0) {
      toast.error(`Se actualizaron ${products.length - errorCount} de ${products.length} productos`)
    } else {
      toast.success(withSyncNote(`Se agregaron ${qty} unidades a ${products.length} productos`))
    }
    fetchAll()
  }

  async function handleSaveCategory() {
    if (!catForm.name.trim()) return
    await syncEngine.createRow('categories', profile!.business_id, { id: crypto.randomUUID(), name: catForm.name.trim() })
    toast.success(withSyncNote('Categoría creada')); setCatForm({ name: '' }); setShowCategoryModal(false); fetchAll()
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('¿Eliminar categoría?')) return
    await syncEngine.deleteRow('categories', profile!.business_id, id)
    toast.success(withSyncNote('Categoría eliminada')); fetchAll()
  }

  async function handleSaveSupplier() {
    if (!supplierForm.name.trim()) return
    await syncEngine.createRow('suppliers', profile!.business_id, {
      id: crypto.randomUUID(),
      name: supplierForm.name.trim(),
      phone: supplierForm.phone || null,
      cuit: supplierForm.cuit || null,
      active: true,
    })
    toast.success(withSyncNote('Proveedor creado')); setSupplierForm({ name: '', phone: '', cuit: '' }); setShowSupplierModal(false); fetchAll()
  }

  function getUnitLabel(p: Product): string {
    return UNIT_SHORT[(p.unit || 'u') as ProductUnit] || 'uds'
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto w-full min-w-0 pb-16">
      {/* Executive Header */}
      <div className="flex flex-col min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between gap-4 pb-3 border-b border-white/[0.06] min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Módulo de Gestión
            </span>
            <span className="text-xs text-white/30">·</span>
            <span className="text-xs text-white/50 font-medium">Catálogo & Stock</span>
          </div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)] mt-1.5">
            Productos
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-0.5">
            Control de inventario, precios de venta, costos de reposición y stock crítico
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full min-[900px]:w-auto">
          <button 
            onClick={() => setShowExportModal(true)} 
            className="flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/80 transition-all active:scale-[0.98] min-w-0"
          >
            <Download className="w-3.5 h-3.5 text-white/60" />
            <span>Exportar</span>
          </button>
          <button 
            onClick={premiumOnly(() => setShowImportModal(true))} 
            className="flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/80 transition-all active:scale-[0.98] min-w-0"
          >
            <Upload className="w-3.5 h-3.5 text-white/60" />
            <span>Importar</span>
          </button>
          <button 
            onClick={openNew} 
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-violet-950/40 transition-all active:scale-[0.98] min-w-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Symmetric 4-Card Executive Metric & Quick Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 min-[1200px]:grid-cols-4 gap-3.5">
        {/* Catálogo Activo */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Catálogo Activo</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {products.length}
            </p>
            <p className="text-[10px] text-white/40 mt-1">
              Valorizado: <span className="text-white/70 font-semibold">{formatCurrency(totalInventoryValue)}</span>
            </p>
          </div>
        </div>

        {/* Alertas de Stock */}
        <button
          onClick={() => setFilterLowStockOnly(prev => !prev)}
          className={cn(
            "rounded-2xl p-4 sm:p-5 border transition-all text-left flex flex-col justify-between group cursor-pointer",
            filterLowStockOnly
              ? "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30"
              : "bg-[#0B1120]/80 border-white/[0.07] hover:border-amber-500/30"
          )}
        >
          <div className="flex items-center justify-between mb-3 w-full">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Stock Crítico</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className={cn("text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight", lowStockProducts.length > 0 ? "text-amber-400" : "text-white")}>
                {lowStockProducts.length}
              </p>
              {filterLowStockOnly && (
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">· Filtrando</span>
              )}
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              {filterLowStockOnly ? "Clic para mostrar todos" : "Clic para ver en riesgo"}
            </p>
          </div>
        </button>

        {/* Ajuste Masivo */}
        <button
          onClick={() => { setShowBulkUnitsModal(true); setBulkConfirmed(false); setBulkUnitsQty('10') }}
          className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-blue-500/30 transition-all text-left flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3 w-full">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Ajuste Masivo</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold text-white tracking-tight">
              Unidades de Stock
            </p>
            <p className="text-[10px] text-white/40 mt-1">
              Sumar cantidad fija a todo el catálogo
            </p>
          </div>
        </button>

        {/* Categorías & Proveedores */}
        <div className="rounded-2xl p-4 sm:p-5 bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Estructura</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 w-full">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="w-full min-w-0 flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/90 transition-all"
            >
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Categorías</span>
            </button>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="w-full min-w-0 flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/90 transition-all"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Proveedores</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center bg-[#0B1120]/80 border border-white/[0.07] rounded-2xl p-2.5 min-w-0">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, código de barra, marca, modelo, material..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/[0.08] bg-[#0E1629] text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all" 
          />
        </div>
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full lg:w-auto h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-white text-xs focus:outline-none focus:border-violet-500/50 cursor-pointer lg:min-w-[170px]"
        >
          <option value="">Todas las categorías ({categories.length})</option>
          {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select 
          value={filterMaterial} 
          onChange={(e) => setFilterMaterial(e.target.value)}
          className="w-full lg:w-auto h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-white text-xs focus:outline-none focus:border-violet-500/50 cursor-pointer lg:min-w-[170px]"
        >
          <option value="">Todos los materiales ({materials.length})</option>
          {materials.map(m => (<option key={m} value={m}>{m}</option>))}
        </select>
        {(search || filterCategory || filterMaterial || filterLowStockOnly) && (
          <button
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterMaterial(''); setFilterLowStockOnly(false) }}
            className="h-11 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-semibold text-white/60 hover:text-white transition-all flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 mr-1.5" /> Limpiar
          </button>
        )}
      </div>

      {/* Bulk selection bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#0B1120]/80 border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-violet-600 cursor-pointer" />
              <span>Seleccionar todos ({filtered.length})</span>
            </label>
            {selected.size > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25">
                {selected.size} seleccionados
              </span>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setSelected(new Set())} className="text-xs text-white/40 hover:text-white underline mr-2">
                Deseleccionar
              </button>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Formato:</span>
              <button disabled={bulkBusy} onClick={() => handleBulkCase('upper')} className="h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white disabled:opacity-40 border border-white/[0.06]">MAYÚS</button>
              <button disabled={bulkBusy} onClick={() => handleBulkCase('lower')} className="h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white disabled:opacity-40 border border-white/[0.06]">minús</button>
              <button disabled={bulkBusy} onClick={() => handleBulkCase('title')} className="h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white disabled:opacity-40 border border-white/[0.06]">Título</button>
              
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider ml-2">Categoría:</span>
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none cursor-pointer">
                <option value="">Elegir...</option>
                {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                <option value="__none__">Sin categoría</option>
              </select>
              <button disabled={bulkBusy || !bulkCategory} onClick={handleBulkCategory} className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white disabled:opacity-40 shadow-sm transition-all">
                {bulkBusy ? 'Guardando...' : 'Aplicar'}
              </button>

              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider ml-2">Más:</span>
              <button disabled={bulkBusy} onClick={premiumOnly(() => setShowBulkPriceModal(true))} className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white disabled:opacity-40 border border-white/[0.06]">
                Cambiar precios
              </button>
              <button onClick={premiumOnly(() => setShowLabelModal(true))} className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white border border-white/[0.06]">
                Imprimir etiquetas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Products Grid */}
      <div>
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-[#0B1120]/40 border border-white/[0.06] rounded-2xl p-8">
            <Package className="w-12 h-12 mx-auto mb-3 text-white/20" />
            <p className="text-sm font-semibold text-white/50">No se encontraron productos coincidentes</p>
            <p className="text-xs text-white/30 mt-1">Probá con otro término de búsqueda o limpiá los filtros activos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 min-[1180px]:grid-cols-3 gap-4">
            {visibleProducts.map((p) => {
              const isLowStock = p.stock <= p.stock_min
              const isOutOfStock = p.stock === 0

              return (
                <div 
                  key={p.id} 
                  className="bg-[#0B1120]/80 border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all group cursor-pointer relative overflow-hidden"
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  {/* Subtle status indicator strip */}
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    isOutOfStock ? "bg-red-500/70" : isLowStock ? "bg-amber-500/70" : "bg-emerald-500/50"
                  )} />

                  <div>
                    {/* Header: Checkbox + Name + Quick Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 mt-0.5 rounded accent-violet-600 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white tracking-tight leading-snug group-hover:text-violet-400 transition-colors line-clamp-2">
                            {p.name}
                          </h3>
                          {(p.brand || p.model) && (
                            <p className="text-[11px] text-white/40 font-medium mt-0.5 truncate">
                              {[p.brand, p.model].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {p.barcode && (
                            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono mt-1">
                              <Barcode className="w-3 h-3 text-white/40" />
                              <span>{p.barcode}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEdit(p) }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all border border-white/[0.06]"
                          title="Editar producto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(p) }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all border border-white/[0.06]"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Category & Material tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {p.category_id && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.05] border border-white/[0.06] text-white/60">
                          {categories.find(c => c.id === p.category_id)?.name || 'Categoría'}
                        </span>
                      )}
                      {p.material && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          {p.material}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Stock footer */}
                  <div className="pt-3 border-t border-white/[0.06] mt-2">
                    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Precio Venta</span>
                        <p className="text-lg font-bold text-white font-mono tabular-nums leading-tight mt-0.5">
                          {formatCurrency(p.sale_price)}
                          <span className="text-[10px] font-normal text-white/40 ml-1">/{getUnitLabel(p)}</span>
                        </p>
                      </div>
                      {p.purchase_price > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Costo</span>
                          <p className="text-xs font-semibold text-white/50 font-mono tabular-nums leading-tight mt-0.5">
                            {formatCurrency(p.avg_cost || p.purchase_price)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Stock stepper & button */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
                      <span className="text-[11px] font-medium text-white/50">Stock:</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleQuickStock(p, -1) }} 
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition-all border border-white/[0.06]"
                          title="Restar 1 unidad"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openStockModal(p) }} 
                          className={cn(
                            "h-7 px-2.5 rounded-lg text-xs font-bold font-mono tabular-nums transition-all flex items-center gap-1 border",
                            isOutOfStock 
                              ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                              : isLowStock 
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                              : "bg-white/[0.05] text-white/90 border-white/[0.08] hover:bg-white/[0.1]"
                          )}
                          title="Ajustar stock"
                        >
                          <span>{isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock}</span>
                          <span className="text-[9px] font-normal text-white/40 uppercase">{getUnitLabel(p)}</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleQuickStock(p, 1) }} 
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition-all border border-white/[0.06]"
                          title="Sumar 1 unidad"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length > visibleProducts.length && (
          <div className="mt-8 text-center">
            <p className="text-white/40 text-xs font-medium mb-3">
              Mostrando {visibleProducts.length} de {filtered.length} productos
            </p>
            <p className="text-[11px] text-white/30">
              Usá los filtros de búsqueda por nombre, categoría o material para encontrar artículos específicos.
            </p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'} size="md">
        <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Nombre del Producto *</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20"
                placeholder="Ej: Tornillo Autoperforante 3/4"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Precio de Venta *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono">$</span>
                  <input 
                    type="number" 
                    value={form.sale_price} 
                    onChange={(e) => setForm({...form, sale_price: e.target.value})} 
                    className="w-full h-11 pl-7 pr-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Costo de Compra</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono">$</span>
                  <input 
                    type="number" 
                    value={form.purchase_price} 
                    onChange={(e) => setForm({...form, purchase_price: e.target.value})} 
                    className="w-full h-11 pl-7 pr-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Unidad</label>
                <select 
                  value={form.unit} 
                  onChange={(e) => setForm({...form, unit: e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
                >
                  {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value} className="bg-[#0E1629]">{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Stock Actual</label>
                <input 
                  type="number" 
                  step={isDecimalUnit(form.unit) ? '0.01' : '1'} 
                  value={form.stock} 
                  onChange={(e) => setForm({...form, stock: e.target.value})} 
                  className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Stock Mínimo</label>
                <input 
                  type="number" 
                  step={isDecimalUnit(form.unit) ? '0.01' : '1'} 
                  value={form.stock_min} 
                  onChange={(e) => setForm({...form, stock_min: e.target.value})} 
                  className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ImagePicker value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} className="w-28 shrink-0" />
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input type="checkbox" checked={form.show_online} onChange={(e) => setForm({ ...form, show_online: e.target.checked })} />
                  Mostrar en la tienda online
                </label>
                <p className="text-[11px] leading-4 text-white/40">La foto se ve en tu tienda online. Se achica sola antes de subirse.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2.5 ml-0.5">Detalles de Material & Variante</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 ml-0.5">Material</label>
                  <input 
                    type="text" 
                    value={form.material} 
                    onChange={(e) => setForm({...form, material: e.target.value})} 
                    placeholder="Ej: Acero" 
                    className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 ml-0.5">Marca</label>
                  <input 
                    type="text" 
                    value={form.brand} 
                    onChange={(e) => setForm({...form, brand: e.target.value})} 
                    placeholder="Ej: Stanley" 
                    className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 ml-0.5">Modelo</label>
                  <input 
                    type="text" 
                    value={form.model} 
                    onChange={(e) => setForm({...form, model: e.target.value})} 
                    placeholder="Ej: FatMax" 
                    className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 ml-0.5">Medida</label>
                  <input 
                    type="text" 
                    value={form.size_label} 
                    onChange={(e) => setForm({...form, size_label: e.target.value})} 
                    placeholder="Ej: 3/4, 10mm" 
                    className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" 
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 ml-0.5">Presentación</label>
                  <input 
                    type="text" 
                    value={form.presentation} 
                    onChange={(e) => setForm({...form, presentation: e.target.value})} 
                    placeholder="Ej: Caja x100 unidades" 
                    className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Código de Barras</label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                  <input 
                    type="text" 
                    value={form.barcode} 
                    onChange={(e) => setForm({...form, barcode: e.target.value})} 
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Categoría</label>
                <select 
                  value={form.category_id} 
                  onChange={(e) => setForm({...form, category_id: e.target.value})} 
                  className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
                >
                  <option value="" className="bg-[#0E1629]">Sin categoría</option>
                  {categories.map(c => (<option key={c.id} value={c.id} className="bg-[#0E1629]">{c.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 ml-0.5">Proveedor</label>
              <select 
                value={form.supplier_id} 
                onChange={(e) => setForm({...form, supplier_id: e.target.value})} 
                className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
              >
                <option value="" className="bg-[#0E1629]">Sin proveedor</option>
                {suppliers.map(s => (<option key={s.id} value={s.id} className="bg-[#0E1629]">{s.name}</option>))}
              </select>
            </div>
          </div>

          <div className="flex gap-2.5 pt-4 border-t border-white/[0.08]">
            <button 
              onClick={() => setShowProductModal(false)}
              className="flex-1 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 font-semibold text-xs hover:bg-white/[0.08] transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveProduct} 
              disabled={saving}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs disabled:opacity-50 transition-all shadow-md shadow-violet-950/40"
            >
              {saving ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stock Modal */}
      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title="Ajustar Stock" size="sm">
        {stockProduct && (
          <div className="space-y-4">
            <p className="text-xs text-white/50 leading-relaxed">
              Sumá o restá unidades al stock de <span className="text-white font-medium">{stockProduct.name}</span>. Usá valores positivos para ingresos y negativos para correcciones o mermas.
            </p>

            {/* Current stock display */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0E1629] border border-white/[0.08]">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Stock actual</p>
                <p className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
                  {isDecimalUnit(stockProduct.unit) ? stockProduct.stock.toFixed(2) : stockProduct.stock}{' '}
                  <span className="text-xs text-white/40 uppercase font-sans font-normal">{getUnitLabel(stockProduct)}</span>
                </p>
              </div>
              {stockAdjustment !== 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Resultado</p>
                  <p className={cn("text-xl font-bold font-mono tabular-nums mt-0.5", stockAdjustment > 0 ? "text-emerald-400" : "text-rose-400")}>
                    {Math.max(0, Math.round((stockProduct.stock + stockAdjustment) * 1000) / 1000)}{' '}
                    <span className="text-xs opacity-60 uppercase font-sans font-normal">{getUnitLabel(stockProduct)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Adjustment input */}
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">Cantidad a ajustar *</label>
              <input
                type="number"
                step={isDecimalUnit(stockProduct.unit) ? '0.01' : '1'}
                value={stockAdjustment || ''}
                onChange={(e) => setStockAdjustment(Number(e.target.value))}
                placeholder="+10 para sumar · -5 para restar"
                autoFocus
                className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>

            {/* Reason input */}
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">Motivo (opcional)</label>
              <input
                type="text"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
                placeholder="Reposición, conteo de inventario, merma..."
                className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 font-semibold text-xs hover:bg-white/[0.08] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={saving || stockAdjustment === 0}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs disabled:opacity-40 transition-all shadow-md shadow-violet-950/40"
              >
                {saving ? 'Guardando...' : 'Aplicar Ajuste'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Categorías de Catálogo" size="sm">
        <div className="space-y-4">
          {/* Add form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre de la nueva categoría..."
              value={catForm.name}
              onChange={(e) => setCatForm({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
              className="flex-1 h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
            />
            <button
              onClick={handleSaveCategory}
              disabled={!catForm.name.trim()}
              className="h-11 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs disabled:opacity-35 transition-all flex items-center justify-center shrink-0 shadow-md shadow-violet-950/40"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Agregar</span>
            </button>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                <span className="text-xs font-medium text-white">{c.name}</span>
                <button onClick={() => handleDeleteCategory(c.id)} className="text-white/30 hover:text-red-400 transition p-1" title="Eliminar categoría">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-xs text-white/30 py-4">No hay categorías registradas aún</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Supplier Modal */}
      <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title="Proveedores" size="sm">
        <div className="space-y-4">
          {/* Add supplier form */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">Nombre o Razón Social *</label>
              <input
                type="text"
                placeholder="Ej: Distribuidora García S.A."
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSupplier()}
                className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">Teléfono</label>
                <input
                  type="text"
                  placeholder="11 2345-6789"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                  className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">CUIT</label>
                <input
                  type="text"
                  placeholder="30-71234567-8"
                  value={supplierForm.cuit}
                  onChange={(e) => setSupplierForm({...supplierForm, cuit: e.target.value})}
                  className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSupplier}
              disabled={!supplierForm.name.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs disabled:opacity-35 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-950/40"
            >
              <Plus className="w-4 h-4" /> Agregar Proveedor
            </button>
          </div>

          {/* Supplier list */}
          {suppliers.length > 0 && (
            <div className="border-t border-white/[0.08] pt-3">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''} registrado{suppliers.length !== 1 ? 's' : ''}</p>
              <div className="space-y-1.5 max-h-52 overflow-auto pr-1">
                {suppliers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-violet-400">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                      {(s.phone || s.cuit) && (
                        <p className="text-[10px] text-white/40 truncate">
                          {[s.phone, s.cuit].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suppliers.length === 0 && (
            <div className="border-t border-white/[0.08] pt-4 text-center">
              <p className="text-xs text-white/30">Sin proveedores registrados aún</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Units Modal */}
      <Modal open={showBulkUnitsModal} onClose={() => setShowBulkUnitsModal(false)} title="Agregar Unidades Masivas" size="sm">
        <div className="space-y-4">
          {/* Warning */}
          <div className="flex gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">Modificación global de inventario</p>
              <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                Esta acción sumará la cantidad ingresada al stock de <span className="font-bold text-amber-200">todos los {products.length} productos activos</span>. Especialmente útil luego de una importación inicial desde Excel sin stock cargado.
              </p>
            </div>
          </div>

          {/* Quantity input */}
          <div>
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5 ml-0.5">Cantidad a sumar por producto *</label>
            <input
              type="number"
              min="1"
              value={bulkUnitsQty}
              onChange={(e) => setBulkUnitsQty(e.target.value)}
              placeholder="Ej: 10"
              className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-[#0E1629] text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Preview */}
          <div className="px-3.5 py-3 rounded-xl bg-[#0E1629] border border-white/[0.08]">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Impacto</p>
            <p className="text-xs text-white/80 mt-0.5">
              Se sumarán <span className="font-bold font-mono text-white">+{Number(bulkUnitsQty) || 0}</span> unidades a cada uno de los <span className="font-bold text-white">{products.length}</span> productos.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkConfirmed}
              onChange={(e) => setBulkConfirmed(e.target.checked)}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="text-xs text-white/70">Comprendo que se modificará el stock de todos los productos</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2.5 pt-2 border-t border-white/[0.08]">
            <button
              onClick={() => setShowBulkUnitsModal(false)}
              className="flex-1 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 font-semibold text-xs hover:bg-white/[0.08] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkAddUnits}
              disabled={bulkSaving || !bulkConfirmed || !Number(bulkUnitsQty) || Number(bulkUnitsQty) <= 0}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs disabled:opacity-40 transition-all shadow-md shadow-violet-950/40"
            >
              {bulkSaving ? 'Aplicando...' : 'Aplicar a Todos'}
            </button>
          </div>
        </div>
      </Modal>

      <ImportProductsModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onDone={fetchAll}
      />
      <ExportProductsModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        products={products}
        categories={categories}
      />
      <BulkPriceModal
        open={showBulkPriceModal}
        onClose={() => setShowBulkPriceModal(false)}
        products={selectedProducts}
        businessId={profile!.business_id}
        onDone={fetchAll}
      />
      <LabelPrintModal open={showLabelModal} onClose={() => setShowLabelModal(false)} products={selectedProducts} />
    </div>
  )
}

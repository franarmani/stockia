import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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
  const { profile } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
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
  })
  const [catForm, setCatForm] = useState({ name: '' })
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', cuit: '' })

  useEffect(() => { if (profile?.business_id) fetchAll() }, [profile?.business_id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: sups }] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name'),
      supabase.from('categories').select('*').eq('business_id', profile!.business_id).order('name'),
      supabase.from('suppliers').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name'),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setSuppliers(sups || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch = !search || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) || (p.model && p.model.toLowerCase().includes(q))
      const matchCat = !filterCategory || p.category_id === filterCategory
      return matchSearch && matchCat
    })
  }, [products, search, filterCategory])

  const visibleProducts = useMemo(() => filtered.slice(0, 30), [filtered])

  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.stock_min), [products])

  function openNew() {
    setEditingProduct(null)
    setForm({ name: '', barcode: '', sale_price: '', purchase_price: '', stock: '', stock_min: '3', category_id: '', unit: 'u', brand: '', size_label: '', model: '', presentation: '', supplier_id: '' })
    setShowProductModal(true)
  }
  function openEdit(p: Product) {
    setEditingProduct(p)
    setForm({
      name: p.name, barcode: p.barcode || '', sale_price: String(p.sale_price), purchase_price: String(p.purchase_price),
      stock: String(p.stock), stock_min: String(p.stock_min), category_id: p.category_id || '',
      unit: p.unit || 'u', brand: p.brand || '', size_label: p.size_label || '',
      model: p.model || '', presentation: p.presentation || '', supplier_id: p.supplier_id || '',
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
    }
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id)
      if (error) {
        toast.error('Error al actualizar')
      } else {
        toast.success('Producto actualizado')
        setShowProductModal(false)
        fetchAll()
      }
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) {
        toast.error('Error al crear')
      } else {
        toast.success('Producto creado')
        setShowProductModal(false)
        fetchAll()
      }
    }
    setSaving(false)
  }

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar ${p.name}?`)) return
    await supabase.from('products').update({ active: false }).eq('id', p.id)
    toast.success('Producto eliminado'); fetchAll()
  }

  async function handleQuickStock(product: Product, delta: number) {
    const newStock = Math.max(0, Math.round((product.stock + delta) * 1000) / 1000)
    await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
    await supabase.from('stock_movements').insert({ business_id: profile!.business_id, product_id: product.id, type: delta > 0 ? 'purchase' : 'adjustment', quantity: delta })
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p))
  }

  function openStockModal(p: Product) { setStockProduct(p); setStockAdjustment(0); setStockReason(''); setShowStockModal(true) }

  async function handleStockAdjust() {
    if (!stockProduct || stockAdjustment === 0) return
    setSaving(true)
    const newStock = Math.max(0, Math.round((stockProduct.stock + stockAdjustment) * 1000) / 1000)
    await supabase.from('products').update({ stock: newStock }).eq('id', stockProduct.id)
    await supabase.from('stock_movements').insert({ business_id: profile!.business_id, product_id: stockProduct.id, type: stockAdjustment > 0 ? 'purchase' : 'adjustment', quantity: stockAdjustment, notes: stockReason })
    toast.success('Stock actualizado'); setShowStockModal(false); setSaving(false); fetchAll()
  }

  async function handleBulkAddUnits() {
    const qty = Number(bulkUnitsQty)
    if (!qty || qty <= 0) { toast.error('Ingresá una cantidad válida'); return }
    setBulkSaving(true)
    const updates = products.map(p => ({
      id: p.id,
      stock: Math.round((p.stock + qty) * 1000) / 1000,
    }))
    let errorCount = 0
    for (const u of updates) {
      const { error } = await supabase.from('products').update({ stock: u.stock }).eq('id', u.id)
      if (error) errorCount++
    }
    // Also log stock movements
    const movements = products.map(p => ({
      business_id: profile!.business_id,
      product_id: p.id,
      type: 'adjustment' as const,
      quantity: qty,
      notes: `Ajuste masivo: +${qty} unidades`,
    }))
    await supabase.from('stock_movements').insert(movements)
    setBulkSaving(false)
    setShowBulkUnitsModal(false)
    setBulkConfirmed(false)
    if (errorCount > 0) {
      toast.error(`Se actualizaron ${products.length - errorCount} de ${products.length} productos`)
    } else {
      toast.success(`Se agregaron ${qty} unidades a ${products.length} productos`)
    }
    fetchAll()
  }

  async function handleSaveCategory() {
    if (!catForm.name.trim()) return
    await supabase.from('categories').insert({ business_id: profile!.business_id, name: catForm.name.trim() })
    toast.success('Categoría creada'); setCatForm({ name: '' }); setShowCategoryModal(false); fetchAll()
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('¿Eliminar categoría?')) return
    await supabase.from('categories').delete().eq('id', id)
    toast.success('Categoría eliminada'); fetchAll()
  }

  async function handleSaveSupplier() {
    if (!supplierForm.name.trim()) return
    await supabase.from('suppliers').insert({
      business_id: profile!.business_id,
      name: supplierForm.name.trim(),
      phone: supplierForm.phone || null,
      cuit: supplierForm.cuit || null,
    })
    toast.success('Proveedor creado'); setSupplierForm({ name: '', phone: '', cuit: '' }); setShowSupplierModal(false); fetchAll()
  }

  function getUnitLabel(p: Product): string {
    return UNIT_SHORT[(p.unit || 'u') as ProductUnit] || 'uds'
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-black">Inventario</p>
          <h1 className="text-3xl font-black text-white mt-1 tracking-tight">Productos</h1>
          <div className="flex items-center gap-2 mt-1">
             <Package className="w-3.5 h-3.5 text-violet-500/50" />
             <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{products.length} productos activos</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:justify-end">
          <GlassButton size="sm" onClick={() => setShowExportModal(true)} className="bg-white/5">
            <Download className="w-3.5 h-3.5" /> Exportar
          </GlassButton>
          <GlassButton size="sm" onClick={() => setShowImportModal(true)} className="bg-white/5">
            <Upload className="w-3.5 h-3.5" /> Importar
          </GlassButton>
          <GlassButton size="sm" onClick={openNew} className="bg-violet-500 text-slate-950 hover:bg-violet-400 border-none font-black shadow-lg shadow-violet-500/20">
            <Plus className="w-4 h-4" /> Nuevo Producto
          </GlassButton>
        </div>
      </div>

      {/* Admin Actions Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-1">
        <button 
          onClick={() => { setShowBulkUnitsModal(true); setBulkConfirmed(false); setBulkUnitsQty('10') }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Stock</p>
            <p className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors">Unidades masivas</p>
          </div>
        </button>

        <button 
          onClick={() => setShowSupplierModal(true)}
          className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Logística</p>
            <p className="text-[11px] font-bold text-white group-hover:text-amber-400 transition-colors">Proveedores</p>
          </div>
        </button>

        <button 
          onClick={() => setShowCategoryModal(true)}
          className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Filtros</p>
            <p className="text-[11px] font-bold text-white group-hover:text-purple-400 transition-colors">Categorías</p>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-3 p-4 rounded-2xl bg-white/[0.01] border border-white/5 opacity-50">
           <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20">
             <Zap className="w-5 h-5" />
           </div>
           <div>
             <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">AI Radar</p>
             <p className="text-[11px] font-bold text-white/20">Próximamente</p>
           </div>
        </div>
      </div>

      {/* Low stock alert - Bento Style */}
      {lowStockProducts.length > 0 && (
        <div className="px-1">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
               <AlertTriangle className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-sm font-black text-white uppercase tracking-widest leading-none">{lowStockProducts.length} Alertas de Stock Bajo</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
              {lowStockProducts.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate uppercase tracking-tight">{p.name}</p>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-0.5">
                      {isDecimalUnit(p.unit) ? p.stock.toFixed(2) : p.stock} / {p.stock_min} mín
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 bg-white/5 rounded-xl p-1">
                    <button onClick={() => handleQuickStock(p, -1)} className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition">
                      <MinusCircle className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-black w-6 text-center text-white">{isDecimalUnit(p.unit) ? p.stock.toFixed(0) : p.stock}</span>
                    <button onClick={() => handleQuickStock(p, 1)} className="w-8 h-8 flex items-center justify-center text-green-500 hover:scale-110 transition">
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 px-1">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar producto, código, marca..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl border border-white/10 bg-white/[0.03] text-white text-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500/30 transition-all placeholder:text-white/20" 
          />
        </div>
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.03] text-white text-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500/30 transition-all appearance-none cursor-pointer min-w-[180px]"
        >
          <option value="" className="bg-slate-900">Todas las categorías</option>
          {categories.map(c => (<option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>))}
        </select>
      </div>

      {/* Products grid */}
      <div className="px-1">
        {filtered.length === 0 ? (
          <div className="text-center py-24 bg-white/[0.01] border border-white/5 rounded-[3rem]">
            <Package className="w-16 h-16 mx-auto mb-4 text-white/5" />
            <p className="text-white/30 font-black uppercase tracking-[0.2em] text-xs">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProducts.map((p) => (
              <div 
                key={p.id} 
                className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 group cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all active:scale-[0.98] relative overflow-hidden"
                onClick={() => navigate(`/products/${p.id}`)}
              >
                {/* Status glow */}
                <div className={cn(
                  "absolute -top-12 -right-12 w-24 h-24 blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity",
                  p.stock === 0 ? "bg-red-500" : p.stock <= p.stock_min ? "bg-amber-500" : "bg-green-500"
                )} />

                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-white tracking-tight leading-tight group-hover:text-primary transition-colors">{p.name}</h3>
                    {(p.brand || p.model) && (
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">
                        {p.brand}{p.model ? ` · ${p.model}` : ''}
                      </p>
                    )}
                    {p.barcode && (
                      <div className="flex items-center gap-1 text-[10px] text-white/20 mt-1.5 font-mono">
                        <Barcode className="w-3 h-3" /> {p.barcode}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEdit(p) }} 
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(p) }} 
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <div>
                    <p className="text-xl font-black text-white tracking-tighter">
                      {formatCurrency(p.sale_price)}
                      <span className="text-[10px] font-bold text-white/20 ml-1 uppercase">/{getUnitLabel(p)}</span>
                    </p>
                    {p.purchase_price > 0 && (
                      <p className="text-[10px] text-white/25 font-bold uppercase tracking-wider mt-0.5">
                        Costo: {formatCurrency(p.avg_cost || p.purchase_price)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {p.category_id && (
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-white/40 uppercase tracking-widest">
                        {categories.find(c => c.id === p.category_id)?.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleQuickStock(p, -1) }} 
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-white/20 hover:text-amber-500 hover:bg-amber-500/10 transition"
                    >
                      <MinusCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openStockModal(p) }} 
                      className={cn(
                        "h-9 px-4 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2",
                        p.stock === 0 ? "bg-red-500 text-slate-950" :
                        p.stock <= p.stock_min ? "bg-amber-500 text-slate-950" :
                        "bg-white/5 text-white"
                      )}
                    >
                      {isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock}
                      <span className="opacity-40 uppercase text-[8px]">{getUnitLabel(p)}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleQuickStock(p, 1) }} 
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-white/20 hover:text-green-500 hover:bg-green-500/10 transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`) }}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-violet-500/10 text-violet-400 group/ai transition-all hover:bg-violet-500 hover:text-slate-950"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">IA</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > visibleProducts.length && (
          <div className="mt-8 text-center">
            <p className="text-white/20 text-[10px] font-black uppercase tracking-widest mb-4">
              Mostrando {visibleProducts.length} de {filtered.length} productos
            </p>
            <GlassButton onClick={() => { /* Real loading logic could go here, but for now we encourage searching */ }} className="bg-white/5 opacity-50 cursor-default">
               Usá el buscador para encontrar más
            </GlassButton>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title={editingProduct ? 'Editar producto' : 'Nuevo producto'} size="md">
        <div className="space-y-4 max-h-[70vh] overflow-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Nombre *</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/20"
                placeholder="Nombre del producto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Precio venta *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input 
                    type="number" 
                    value={form.sale_price} 
                    onChange={(e) => setForm({...form, sale_price: e.target.value})} 
                    className="w-full h-11 pl-8 pr-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Costo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input 
                    type="number" 
                    value={form.purchase_price} 
                    onChange={(e) => setForm({...form, purchase_price: e.target.value})} 
                    className="w-full h-11 pl-8 pr-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Unidad</label>
                <select 
                  value={form.unit} 
                  onChange={(e) => setForm({...form, unit: e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
                >
                  {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value} className="bg-slate-900">{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Stock</label>
                <input 
                  type="number" 
                  step={isDecimalUnit(form.unit) ? '0.01' : '1'} 
                  value={form.stock} 
                  onChange={(e) => setForm({...form, stock: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Stock mín</label>
                <input 
                  type="number" 
                  step={isDecimalUnit(form.unit) ? '0.01' : '1'} 
                  value={form.stock_min} 
                  onChange={(e) => setForm({...form, stock_min: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-3 ml-1">Detalles de Variante</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Marca</label>
                  <input 
                    type="text" 
                    value={form.brand} 
                    onChange={(e) => setForm({...form, brand: e.target.value})} 
                    placeholder="Ej: Stanley" 
                    className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/10" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Modelo</label>
                  <input 
                    type="text" 
                    value={form.model} 
                    onChange={(e) => setForm({...form, model: e.target.value})} 
                    placeholder="Ej: FatMax" 
                    className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/10" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Medida</label>
                  <input 
                    type="text" 
                    value={form.size_label} 
                    onChange={(e) => setForm({...form, size_label: e.target.value})} 
                    placeholder="Ej: 3/4, 10mm" 
                    className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/10" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Presentación</label>
                  <input 
                    type="text" 
                    value={form.presentation} 
                    onChange={(e) => setForm({...form, presentation: e.target.value})} 
                    placeholder="Ej: x6 unids" 
                    className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/10" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Código de barras</label>
                <div className="relative">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                  <input 
                    type="text" 
                    value={form.barcode} 
                    onChange={(e) => setForm({...form, barcode: e.target.value})} 
                    className="w-full h-11 pl-11 pr-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Categoría</label>
                <select 
                  value={form.category_id} 
                  onChange={(e) => setForm({...form, category_id: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">Sin categoría</option>
                  {categories.map(c => (<option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Proveedor</label>
              <select 
                value={form.supplier_id} 
                onChange={(e) => setForm({...form, supplier_id: e.target.value})} 
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-900">Sin proveedor</option>
                {suppliers.map(s => (<option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button 
              onClick={() => setShowProductModal(false)}
              className="flex-1 h-12 rounded-2xl border border-white/10 bg-white/5 text-white/70 font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveProduct} 
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-violet-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stock Modal */}
      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title="Ajustar stock" size="sm">
        {stockProduct && (
          <div className="space-y-4">
            {/* Explanation */}
            <p className="text-[13px] text-white/45 leading-relaxed">
              Sumá o restá unidades al stock de <span className="text-white/80 font-medium">{stockProduct.name}</span>. Usá valores positivos para ingresar mercadería y negativos para registrar pérdidas o correcciones.
            </p>

            {/* Current stock display */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/8">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Stock actual</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {isDecimalUnit(stockProduct.unit) ? stockProduct.stock.toFixed(2) : stockProduct.stock}{' '}
                  <span className="text-base text-white/40">{getUnitLabel(stockProduct)}</span>
                </p>
              </div>
              {stockAdjustment !== 0 && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Resultado</p>
                  <p className={`text-xl font-bold mt-0.5 ${stockAdjustment > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.max(0, Math.round((stockProduct.stock + stockAdjustment) * 1000) / 1000)}{' '}
                    <span className="text-base opacity-60">{getUnitLabel(stockProduct)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Adjustment input */}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Cantidad a ajustar</label>
              <input
                type="number"
                step={isDecimalUnit(stockProduct.unit) ? '0.01' : '1'}
                value={stockAdjustment || ''}
                onChange={(e) => setStockAdjustment(Number(e.target.value))}
                placeholder="+10 para sumar · -5 para restar"
                autoFocus
                className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>

            {/* Reason input */}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Motivo (opcional)</label>
              <input
                type="text"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
                placeholder="Reposición, inventario, merma..."
                className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 h-10 rounded-xl border border-white/12 bg-white/6 text-white/70 font-semibold text-sm hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={saving || stockAdjustment === 0}
                className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-35 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/20"
              >
                {saving ? 'Guardando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Categorías" size="sm">
        <div className="space-y-4">
          {/* Add form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre de la categoría..."
              value={catForm.name}
              onChange={(e) => setCatForm({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
              className="flex-1 h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
            />
            <button
              onClick={handleSaveCategory}
              disabled={!catForm.name.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-white disabled:opacity-35 hover:bg-primary/90 transition flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-56 overflow-auto">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
                <span className="text-sm font-medium text-white">{c.name}</span>
                <button onClick={() => handleDeleteCategory(c.id)} className="text-white/30 hover:text-red-400 transition p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-sm text-white/30 py-4">Sin categorías</p>
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
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Nombre *</label>
              <input
                type="text"
                placeholder="Ej: Distribuidora García"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSupplier()}
                className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Teléfono</label>
                <input
                  type="text"
                  placeholder="11 2345-6789"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">CUIT</label>
                <input
                  type="text"
                  placeholder="20-12345678-9"
                  value={supplierForm.cuit}
                  onChange={(e) => setSupplierForm({...supplierForm, cuit: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSupplier}
              disabled={!supplierForm.name.trim()}
              className="w-full h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-35 hover:bg-primary/90 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Agregar proveedor
            </button>
          </div>

          {/* Supplier list */}
          {suppliers.length > 0 && (
            <div className="border-t border-white/8 pt-3">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
              <div className="space-y-1.5 max-h-52 overflow-auto pr-0.5">
                {suppliers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      {(s.phone || s.cuit) && (
                        <p className="text-xs text-white/40 truncate">
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
            <div className="border-t border-white/8 pt-4 text-center">
              <p className="text-sm text-white/30">Sin proveedores aún</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Units Modal */}
      <Modal open={showBulkUnitsModal} onClose={() => setShowBulkUnitsModal(false)} title="Agregar unidades masivas" size="sm">
        <div className="space-y-4">
          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Atención</p>
              <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">
                Esta acción sumará la cantidad indicada al stock de <span className="font-bold text-amber-200">todos los {products.length} productos activos</span>. Es útil cuando importás productos desde Excel sin unidades cargadas. Esta acción no se puede deshacer fácilmente.
              </p>
            </div>
          </div>

          {/* Quantity input */}
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Cantidad a sumar por producto</label>
            <input
              type="number"
              min="1"
              value={bulkUnitsQty}
              onChange={(e) => setBulkUnitsQty(e.target.value)}
              placeholder="Ej: 10"
              className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
            />
          </div>

          {/* Preview */}
          <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
            <p className="text-xs text-white/40">Resultado</p>
            <p className="text-sm text-white/80 mt-1">
              Se sumarán <span className="font-bold text-white">{Number(bulkUnitsQty) || 0}</span> unidades a cada uno de los <span className="font-bold text-white">{products.length}</span> productos.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkConfirmed}
              onChange={(e) => setBulkConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/8 text-primary focus:ring-primary/25"
            />
            <span className="text-sm text-white/60">Entiendo que se modificará el stock de todos los productos</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowBulkUnitsModal(false)}
              className="flex-1 h-10 rounded-xl border border-white/12 bg-white/6 text-white/70 font-semibold text-sm hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkAddUnits}
              disabled={bulkSaving || !bulkConfirmed || !Number(bulkUnitsQty) || Number(bulkUnitsQty) <= 0}
              className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-35 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/20"
            >
              {bulkSaving ? 'Aplicando...' : 'Aplicar a todos'}
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
    </div>
  )
}

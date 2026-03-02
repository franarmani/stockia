import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { isDecimalUnit } from '@/stores/posStore'
import { UNIT_SHORT, UNIT_LABELS, type ProductUnit } from '@/types/database'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ImportProductsModal from '@/components/ImportProductsModal'
import ExportProductsModal from '@/components/ExportProductsModal'
import type { Product, Category, Supplier } from '@/types/database'
import {
  Search, Plus, Package, AlertTriangle,
  Barcode, MinusCircle, PlusCircle, Edit3, Trash2,
  Tag, X, Truck, Upload, Download,
} from 'lucide-react'

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: 'u', label: 'Unidad (u)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'mts', label: 'Metro (mts)' },
  { value: 'lts', label: 'Litro (lts)' },
]

export default function ProductsPage() {
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

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !search || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) || (p.model && p.model.toLowerCase().includes(q))
    const matchCat = !filterCategory || p.category_id === filterCategory
    return matchSearch && matchCat
  })

  const lowStockProducts = products.filter(p => p.stock <= p.stock_min)

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
      if (error) toast.error('Error al actualizar'); else toast.success('Producto actualizado')
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) toast.error('Error al crear'); else toast.success('Producto creado')
    }
    setSaving(false); setShowProductModal(false); fetchAll()
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
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos activos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSupplierModal(true)}>
            <Truck className="w-4 h-4" /> Proveedores
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCategoryModal(true)}>
            <Tag className="w-4 h-4" /> Categorías
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">{lowStockProducts.length} productos con stock bajo</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lowStockProducts.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-amber-600">{isDecimalUnit(p.unit) ? p.stock.toFixed(2) : p.stock} de {p.stock_min} mín</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleQuickStock(p, -1)} className="w-7 h-7 flex items-center justify-center text-amber-600 hover:text-amber-800 active:scale-90 transition">
                    <MinusCircle className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold w-8 text-center">{isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock}</span>
                  <button onClick={() => handleQuickStock(p, 1)} className="w-7 h-7 flex items-center justify-center text-green-600 hover:text-green-800 active:scale-90 transition">
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar producto, código, marca..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Todas las categorías</option>
          {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-15" />
          <p className="font-medium">No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm group">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                  {(p.brand || p.model) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.brand}{p.model ? ` · ${p.model}` : ''}{p.size_label ? ` · ${p.size_label}` : ''}{p.presentation ? ` · ${p.presentation}` : ''}
                    </p>
                  )}
                  {p.barcode && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Barcode className="w-3 h-3" /> {p.barcode}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                  <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-base font-bold text-primary">{formatCurrency(p.sale_price)}<span className="text-xs font-normal text-muted-foreground ml-1">/{getUnitLabel(p)}</span></p>
                  {p.purchase_price > 0 && <p className="text-xs text-muted-foreground">Costo: {formatCurrency(p.avg_cost || p.purchase_price)}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {p.category_id && <Badge variant="default" className="text-[10px]">{categories.find(c => c.id === p.category_id)?.name}</Badge>}
                    {p.unit && p.unit !== 'u' && <Badge variant="outline" className="text-[10px]">{UNIT_SHORT[p.unit as ProductUnit]}</Badge>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => handleQuickStock(p, -1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-amber-600 hover:bg-amber-50 active:scale-90 transition">
                    <MinusCircle className="w-5 h-5" />
                  </button>
                  <button onClick={() => openStockModal(p)} className={`min-w-9 h-8 px-2 rounded-xl text-sm font-bold text-center transition cursor-pointer ${
                    p.stock === 0 ? 'bg-red-100 text-red-700' :
                    p.stock <= p.stock_min ? 'bg-amber-100 text-amber-700' :
                    'bg-green-50 text-green-700'
                  }`}>{isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock}</button>
                  <button onClick={() => handleQuickStock(p, 1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-green-600 hover:bg-green-50 active:scale-90 transition">
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title={editingProduct ? 'Editar producto' : 'Nuevo producto'} size="md">
        <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Precio venta *</label>
              <input type="number" value={form.sale_price} onChange={(e) => setForm({...form, sale_price: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <input type="number" value={form.purchase_price} onChange={(e) => setForm({...form, purchase_price: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Unidad</label>
              <select value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <input type="number" step={isDecimalUnit(form.unit) ? '0.01' : '1'} value={form.stock} onChange={(e) => setForm({...form, stock: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock mín</label>
              <input type="number" step={isDecimalUnit(form.unit) ? '0.01' : '1'} value={form.stock_min} onChange={(e) => setForm({...form, stock_min: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Variant fields */}
          <div className="border-t border-slate-200 pt-3 mt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Variante / Detalle</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <input type="text" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} placeholder="Ej: Stanley" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Modelo</label>
                <input type="text" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} placeholder="Ej: FatMax" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Medida</label>
                <input type="text" value={form.size_label} onChange={(e) => setForm({...form, size_label: e.target.value})} placeholder="Ej: 3/4, 10mm, 5L" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Presentación</label>
                <input type="text" value={form.presentation} onChange={(e) => setForm({...form, presentation: e.target.value})} placeholder="Ej: x6 unids, 25kg" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Código de barras</label>
              <input type="text" value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select value={form.category_id} onChange={(e) => setForm({...form, category_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Sin categoría</option>
                {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proveedor</label>
            <select value={form.supplier_id} onChange={(e) => setForm({...form, supplier_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Sin proveedor</option>
              {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowProductModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveProduct} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
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

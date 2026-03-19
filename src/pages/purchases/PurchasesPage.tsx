import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { isDecimalUnit } from '@/stores/posStore'
import { UNIT_SHORT, type ProductUnit } from '@/types/database'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import type { Product, Supplier } from '@/types/database'
import {
  Plus, Trash2, Search, Package, Truck,
  ChevronDown, ShoppingBag, X, UserPlus, FileText,
} from 'lucide-react'

interface PurchaseItem {
  product: Product
  quantity: number
  unit_cost: number
}

export default function PurchasesPage() {
  const { profile } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // New purchase state
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [newSupplierCuit, setNewSupplierCuit] = useState('')
  const [savingSupplier, setSavingSupplier] = useState(false)

  useEffect(() => { if (profile?.business_id) fetchAll() }, [profile?.business_id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: prods }, { data: sups }, { data: purch }] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name'),
      supabase.from('suppliers').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name'),
      supabase.from('purchases').select('*, supplier:suppliers(name), user:users!purchases_user_id_fkey(name), purchase_items(*, product:products(name, unit))')
        .eq('business_id', profile!.business_id).order('created_at', { ascending: false }).limit(50),
    ])
    setProducts(prods || [])
    setSuppliers(sups || [])
    setPurchases(purch || [])
    setLoading(false)
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_cost, 0), [items])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return []
    const q = productSearch.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [productSearch, products])

  function addProduct(p: Product) {
    if (items.some(i => i.product.id === p.id)) { toast.error('Ya está en la lista'); return }
    setItems([...items, { product: p, quantity: 1, unit_cost: p.avg_cost || p.purchase_price || 0 }])
    setProductSearch(''); setShowProductPicker(false)
  }

  function updateItem(idx: number, field: 'quantity' | 'unit_cost', value: number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function handleCreateSupplier() {
    if (!newSupplierName.trim()) { toast.error('Ingresá el nombre'); return }
    setSavingSupplier(true)
    const { data, error } = await supabase.from('suppliers').insert({
      business_id: profile!.business_id,
      name: newSupplierName.trim(),
      phone: newSupplierPhone || null,
      cuit: newSupplierCuit || null,
    }).select().single()
    setSavingSupplier(false)
    if (error) { toast.error('Error al crear proveedor'); return }
    setSuppliers(prev => [...prev, data])
    setSelectedSupplierId(data.id)
    setNewSupplierName(''); setNewSupplierPhone(''); setNewSupplierCuit('')
    setShowSupplierModal(false)
    toast.success('Proveedor creado')
  }

  async function handleSavePurchase() {
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return }
    setSaving(true)
    try {
      // 1. Create purchase
      const { data: purchase, error: purchError } = await supabase.from('purchases').insert({
        business_id: profile!.business_id,
        supplier_id: selectedSupplierId || null,
        total,
        notes: purchaseNotes || null,
        user_id: profile!.id,
      }).select().single()

      if (purchError || !purchase) throw purchError

      // 2. Insert purchase items
      const purchaseItems = items.map(i => ({
        purchase_id: purchase.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: Math.round(i.quantity * i.unit_cost * 100) / 100,
      }))
      await supabase.from('purchase_items').insert(purchaseItems)

      // 3. Update product stock + avg_cost for each item
      for (const item of items) {
        const p = item.product
        const oldStock = p.stock
        const oldAvgCost = p.avg_cost || p.purchase_price || 0
        const newStock = Math.round((oldStock + item.quantity) * 1000) / 1000

        // Weighted average cost: (oldStock*oldCost + qty*newCost) / (oldStock + qty)
        const totalValue = oldStock * oldAvgCost + item.quantity * item.unit_cost
        const newAvgCost = newStock > 0 ? Math.round((totalValue / newStock) * 100) / 100 : item.unit_cost

        await supabase.from('products').update({
          stock: newStock,
          avg_cost: newAvgCost,
          purchase_price: item.unit_cost, // Also update last purchase price
        }).eq('id', p.id)

        // Stock movement
        await supabase.from('stock_movements').insert({
          business_id: profile!.business_id,
          product_id: p.id,
          type: 'purchase',
          quantity: item.quantity,
          notes: `Compra ${purchase.id.slice(0, 8)}`,
        })
      }

      toast.success('Compra registrada')
      resetForm()
      fetchAll()
    } catch (err) {
      toast.error('Error al guardar la compra')
      console.error(err)
    }
    setSaving(false)
  }

  function resetForm() {
    setShowNewPurchase(false)
    setSelectedSupplierId('')
    setPurchaseNotes('')
    setItems([])
    setProductSearch('')
  }

  function getUnitLabel(unit?: string): string {
    return UNIT_SHORT[(unit || 'u') as ProductUnit] || 'uds'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="animate-fade-in space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Compras</h1>
          <p className="text-[13px] text-white/45 mt-0.5">Ingreso de mercadería y proveedores</p>
        </div>
        <button
          onClick={() => setShowNewPurchase(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-95 transition self-start sm:self-auto shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nueva compra
        </button>
      </div>

      {/* ── New purchase form ── */}
      {showNewPurchase && (
        <div className="bg-white/6 border border-white/10 rounded-2xl p-5 space-y-4 animate-fade-in-up">
          {/* Form header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-semibold text-white">Registrar compra</h2>
            </div>
            <button onClick={resetForm} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Supplier selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Proveedor</label>
            <div className="flex gap-2">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-white/12 bg-white/8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              >
                <option value="" className="bg-[#07142f]">Sin proveedor</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#07142f]">
                    {s.name}{s.phone ? ` · ${s.phone}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="h-10 px-3 rounded-xl border border-white/12 bg-white/8 text-white/60 hover:bg-white/15 hover:text-white transition flex items-center gap-1.5 text-sm font-medium shrink-0"
                title="Nuevo proveedor"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Product search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Productos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o marca..."
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowProductPicker(true) }}
                onFocus={() => productSearch && setShowProductPicker(true)}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-white/12 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
              {showProductPicker && filteredProducts.length > 0 && (
                <div className="absolute top-11 left-0 right-0 bg-[rgba(7,20,47,0.98)] border border-white/12 rounded-2xl shadow-2xl z-20 max-h-56 overflow-auto backdrop-blur-xl">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/8 transition text-left border-b border-white/6 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        <p className="text-xs text-white/40">
                          {p.brand ? `${p.brand} · ` : ''}Stock: {isDecimalUnit(p.unit) ? p.stock.toFixed(1) : p.stock} {getUnitLabel(p.unit)}
                        </p>
                      </div>
                      <span className="text-xs text-primary font-medium shrink-0 ml-3">
                        {formatCurrency(p.avg_cost || p.purchase_price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_110px_80px_36px] gap-0 bg-white/6 px-3 py-2 text-[11px] font-semibold text-white/45 uppercase tracking-wider">
                <span>Producto</span>
                <span className="text-center">Cantidad</span>
                <span className="text-center">Costo unit.</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              <div className="divide-y divide-white/6">
                {items.map((item, idx) => (
                  <div key={item.product.id} className="grid grid-cols-[1fr_100px_110px_80px_36px] gap-0 items-center px-3 py-2.5">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                      <p className="text-[11px] text-white/40">{getUnitLabel(item.product.unit)}</p>
                    </div>
                    <div className="px-1">
                      <input
                        type="number" min="0.01"
                        step={isDecimalUnit(item.product.unit) ? '0.01' : '1'}
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-full h-8 px-2 rounded-lg border border-white/12 bg-white/8 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <div className="px-1">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.unit_cost || ''}
                        onChange={(e) => updateItem(idx, 'unit_cost', Number(e.target.value))}
                        className="w-full h-8 px-2 rounded-lg border border-white/12 bg-white/8 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <div className="text-right pr-1">
                      <span className="text-sm font-bold text-white">{formatCurrency(item.quantity * item.unit_cost)}</span>
                    </div>
                    <button onClick={() => removeItem(idx)} className="flex items-center justify-center text-white/25 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes + Total + Actions */}
          <div className="flex flex-col sm:flex-row gap-3 items-end pt-1">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Notas (opcional)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="Nº factura, observaciones..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/12 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/40">Total compra</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={resetForm}
              className="flex-1 h-11 rounded-xl border border-white/12 bg-white/6 text-white/70 font-semibold text-sm hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSavePurchase}
              disabled={saving || items.length === 0}
              className="flex-1 h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-35 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/20"
            >
              {saving ? 'Guardando...' : `Registrar (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
            </button>
          </div>
        </div>
      )}

      {/* ── Purchase history ── */}
      <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Historial de compras</h2>
              {purchases.length > 0 && (
                <p className="text-[11px] text-white/40">{purchases.length} registros</p>
              )}
            </div>
          </div>
        </div>

        {purchases.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white/20" />
            </div>
            <p className="font-semibold text-white/40">Sin compras registradas</p>
            <p className="text-sm text-white/25 mt-1">Registrá tu primera compra para actualizar stock y costos</p>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {purchases.map((p) => (
              <details key={p.id} className="group">
                <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/4 transition list-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.supplier?.name || 'Sin proveedor'}</p>
                      <p className="text-xs text-white/40">
                        {formatDate(p.created_at)} · {p.purchase_items?.length || 0} producto{p.purchase_items?.length !== 1 ? 's' : ''}
                        {p.notes && <span className="ml-1">· {p.notes}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-bold text-white">{formatCurrency(p.total)}</span>
                    <ChevronDown className="w-4 h-4 text-white/30 group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                <div className="px-4 pb-3 pt-1">
                  <div className="bg-white/4 border border-white/8 rounded-xl divide-y divide-white/6 overflow-hidden">
                    {(p.purchase_items || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-white">{item.product?.name || 'Producto'}</span>
                          <span className="text-white/40 ml-2 text-xs">
                            {item.quantity} {getUnitLabel(item.product?.unit)} × {formatCurrency(item.unit_cost)}
                          </span>
                        </div>
                        <span className="font-bold text-white shrink-0 ml-2">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* ── New supplier modal ── */}
      <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title="Nuevo proveedor" size="sm">
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Nombre *</label>
              <input
                type="text"
                autoFocus
                placeholder="Ej: Distribuidora García"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSupplier()}
                className="w-full h-11 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Teléfono</label>
                <input
                  type="text"
                  placeholder="11 2345-6789"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">CUIT</label>
                <input
                  type="text"
                  placeholder="20-12345678-9"
                  value={newSupplierCuit}
                  onChange={(e) => setNewSupplierCuit(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowSupplierModal(false)}
              className="flex-1 h-11 rounded-xl border border-white/12 bg-white/6 text-white/70 font-semibold text-sm hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateSupplier}
              disabled={savingSupplier || !newSupplierName.trim()}
              className="flex-1 h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-35 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/20"
            >
              {savingSupplier ? 'Guardando...' : 'Agregar proveedor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

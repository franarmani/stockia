/**
 * CatalogModal — build and send a quick catalog message.
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import {
  Search,
  SortAsc,
  Layers,
  Eye,
  Package,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  sale_price: number
  stock: number
  category_id: string | null
}

interface Category {
  id: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  onInsert: (catalogText: string) => void
}

type SortMode = 'name' | 'price_asc' | 'price_desc' | 'stock'

export default function CatalogModal({ open, onClose, onInsert }: Props) {
  const { profile } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [limit, setLimit] = useState(10)
  const [includeStock, setIncludeStock] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !profile?.business_id) return
    ;(async () => {
      setLoading(true)
      const [prodRes, catRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sale_price, stock, category_id')
          .eq('business_id', profile.business_id)
          .eq('active', true)
          .order('name')
          .limit(200),
        supabase
          .from('categories')
          .select('id, name')
          .eq('business_id', profile.business_id)
          .order('name'),
      ])
      setProducts((prodRes.data as Product[]) || [])
      setCategories((catRes.data as Category[]) || [])
      setLoading(false)
    })()
  }, [open, profile?.business_id])

  const filtered = useMemo(() => {
    let list = products

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (categoryId !== 'all') {
      list = list.filter((p) => p.category_id === categoryId)
    }

    switch (sortMode) {
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price_asc':
        list = [...list].sort((a, b) => a.sale_price - b.sale_price)
        break
      case 'price_desc':
        list = [...list].sort((a, b) => b.sale_price - a.sale_price)
        break
      case 'stock':
        list = [...list].sort((a, b) => b.stock - a.stock)
        break
    }

    return list.slice(0, limit)
  }, [products, search, categoryId, sortMode, limit])

  // Build catalog text
  const catalogText = useMemo(() => {
    const items = selectedIds.size > 0
      ? filtered.filter((p) => selectedIds.has(p.id))
      : filtered

    let text = '📋 *Catálogo rápido:*\n\n'
    items.forEach((p, i) => {
      text += `${i + 1}) *${p.name}* — ${formatCurrency(p.sale_price)}`
      if (includeStock) text += ` (stock: ${p.stock})`
      text += '\n'
    })
    text += '\n_Consultame si querés reservar alguno_ 🤝'
    return text
  }, [filtered, selectedIds, includeStock])

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Catálogo rápido" size="lg">
      <div className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#25D366]/50"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="name">A-Z</option>
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
            <option value="stock">Stock ↓</option>
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value={5}>5 productos</option>
            <option value={10}>10 productos</option>
            <option value={20}>20 productos</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={includeStock}
              onChange={(e) => setIncludeStock(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-[#25D366] focus:ring-[#25D366]/30"
            />
            Mostrar stock
          </label>
        </div>

        {/* Product list */}
        <div className="max-h-52 overflow-y-auto rounded-xl border border-white/5">
          {loading ? (
            <div className="py-8 text-center text-sm text-white/30">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/30">Sin productos</div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    selectedIds.has(p.id)
                      ? 'bg-[#25D366]/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Package className="w-4 h-4 text-white/30 shrink-0" />
                  <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                  <span className="text-xs text-white/50">{formatCurrency(p.sale_price)}</span>
                  {includeStock && (
                    <span className="text-[10px] text-white/30">stk: {p.stock}</span>
                  )}
                  {selectedIds.has(p.id) && (
                    <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5 flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            Vista previa del mensaje
          </p>
          <div className="bg-[#0b141a] border border-white/5 rounded-xl p-3 text-sm text-[#e9edef] whitespace-pre-wrap max-h-40 overflow-y-auto">
            {catalogText}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="glass-btn px-4 py-2 text-xs font-medium rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onInsert(catalogText); onClose() }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1fb855] text-white font-semibold text-sm transition-all"
          >
            Insertar en mensaje
          </button>
        </div>
      </div>
    </Modal>
  )
}

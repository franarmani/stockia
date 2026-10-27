import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, ClipboardCheck, Pencil, Plus, Search, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { syncEngine } from '@/sync/syncEngine'
import { adjustLocalStock, deleteLocalRow, getLocalProducts, upsertLocalRow } from '@/sync/storage'
import { callRpcOrQueue } from '@/sync/remote'
import { withSyncNote } from '@/sync/connectivity'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { localStock, stockByProduct, type Warehouse, type WarehouseStockRow } from '@/features/warehouses/warehouseStock'
import type { Product } from '@/types/database'

const LOCAL = 'local'
const PAGE_SIZE = 100

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

type MoveForm = { product: Product; from: string; to: string; quantity: string }
type CountForm = { product: Product; warehouseId: string; quantity: string }

export default function WarehousesPage() {
  const { profile } = useAuthStore()
  const businessId = profile?.business_id
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stockRows, setStockRows] = useState<WarehouseStockRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<string>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [nameModal, setNameModal] = useState<{ id?: string; name: string } | null>(null)
  const [move, setMove] = useState<MoveForm | null>(null)
  const [count, setCount] = useState<CountForm | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!businessId) return
    try {
      const [whs, rows, prods] = await Promise.all([
        syncEngine.pullRows<Warehouse>('warehouses', businessId, () =>
          (supabase as any).from('warehouses').select('*').eq('business_id', businessId)),
        syncEngine.pullRows<WarehouseStockRow>('warehouse_stock', businessId, () =>
          (supabase as any).from('warehouse_stock').select('*').eq('business_id', businessId)),
        getLocalProducts(businessId),
      ])
      setWarehouses([...whs].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))))
      setStockRows(rows)
      setProducts((prods as unknown as Product[]).filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es')))
    } catch (error) {
      console.error('[Warehouses] load failed:', error)
      toast.error('No se pudieron cargar los depósitos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!businessId) return
    load()
    return syncEngine.onSynced(() => { load() })
  }, [businessId])

  const byProduct = useMemo(() => stockByProduct(stockRows), [stockRows])

  const qtyIn = (product: Product, place: string) =>
    place === LOCAL ? localStock(product.stock, byProduct.get(product.id)) : byProduct.get(product.id)?.get(place) ?? 0

  const warehouseTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of stockRows) totals.set(row.warehouse_id, (totals.get(row.warehouse_id) ?? 0) + (Number(row.quantity) || 0))
    return totals
  }, [stockRows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term) && !p.barcode?.toLowerCase().includes(term)) return false
      if (view !== 'all' && qtyIn(p, view) === 0) return false
      return true
    })
  }, [products, search, view, byProduct])

  const placeName = (place: string) => place === LOCAL ? 'Local' : warehouses.find(w => w.id === place)?.name ?? 'Depósito'

  async function saveName() {
    if (!businessId || !nameModal) return
    const name = nameModal.name.trim()
    if (!name) { toast.error('Poné un nombre'); return }
    setSaving(true)
    try {
      if (nameModal.id) {
        await syncEngine.updateRow('warehouses', businessId, nameModal.id, { name, updated_at: new Date().toISOString() })
      } else {
        await syncEngine.createRow('warehouses', businessId, { id: crypto.randomUUID(), name, created_at: new Date().toISOString() })
      }
      toast.success(withSyncNote(nameModal.id ? 'Depósito actualizado' : 'Depósito creado'))
      setNameModal(null)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function removeWarehouse(warehouse: Warehouse) {
    if (!businessId) return
    const units = warehouseTotals.get(warehouse.id) ?? 0
    const message = units > 0
      ? `¿Eliminar "${warehouse.name}"? Las ${fmt(units)} unidades que tiene vuelven al Local.`
      : `¿Eliminar "${warehouse.name}"?`
    if (!confirm(message)) return
    await syncEngine.deleteRow('warehouses', businessId, warehouse.id)
    for (const row of stockRows.filter(r => r.warehouse_id === warehouse.id)) await deleteLocalRow('warehouse_stock', row.id)
    setStockRows(rows => rows.filter(r => r.warehouse_id !== warehouse.id))
    if (view === warehouse.id) setView('all')
    toast.success(withSyncNote('Depósito eliminado'))
    load()
  }

  /** Deja la cantidad local igual a lo que hizo el servidor, para verla al instante también sin internet. */
  async function setLocalQuantity(productId: string, warehouseId: string, quantity: number) {
    if (!businessId) return
    const existing = stockRows.find(r => r.product_id === productId && r.warehouse_id === warehouseId)
    const row = { ...(existing ?? { id: crypto.randomUUID(), business_id: businessId, warehouse_id: warehouseId, product_id: productId }), quantity }
    await upsertLocalRow('warehouse_stock', businessId, row)
  }

  async function submitMove() {
    if (!businessId || !move) return
    const quantity = Number(move.quantity)
    if (!(quantity > 0)) { toast.error('Ingresá una cantidad'); return }
    if (move.from === move.to) { toast.error('Elegí lugares distintos'); return }
    const available = qtyIn(move.product, move.from)
    if (quantity > available) { toast.error(`En ${placeName(move.from)} hay ${fmt(Math.max(available, 0))}`); return }
    setSaving(true)
    try {
      await callRpcOrQueue({
        business_id: businessId,
        rpc: 'warehouse_transfer',
        args: {
          p_id: crypto.randomUUID(), p_business_id: businessId, p_product_id: move.product.id,
          p_from: move.from === LOCAL ? null : move.from, p_to: move.to === LOCAL ? null : move.to, p_quantity: quantity,
        },
        label: `Mover ${fmt(quantity)} de ${move.product.name}`,
        tables: ['warehouse_stock'],
      })
      if (move.from !== LOCAL) await setLocalQuantity(move.product.id, move.from, qtyIn(move.product, move.from) - quantity)
      if (move.to !== LOCAL) await setLocalQuantity(move.product.id, move.to, qtyIn(move.product, move.to) + quantity)
      toast.success(withSyncNote(`Movido a ${placeName(move.to)}`))
      setMove(null)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo mover')
    } finally {
      setSaving(false)
    }
  }

  async function submitCount() {
    if (!businessId || !count) return
    const quantity = Number(count.quantity)
    if (count.quantity === '' || !(quantity >= 0)) { toast.error('Ingresá la cantidad contada'); return }
    const delta = quantity - qtyIn(count.product, count.warehouseId)
    setSaving(true)
    try {
      await callRpcOrQueue({
        business_id: businessId,
        rpc: 'warehouse_set_quantity',
        args: {
          p_id: crypto.randomUUID(), p_business_id: businessId, p_product_id: count.product.id,
          p_warehouse_id: count.warehouseId, p_quantity: quantity,
        },
        label: `Recuento de ${count.product.name}`,
        tables: ['warehouse_stock', 'products'],
      })
      await setLocalQuantity(count.product.id, count.warehouseId, quantity)
      if (delta) await adjustLocalStock(count.product.id, delta)
      toast.success(withSyncNote(delta ? `Stock ajustado (${delta > 0 ? '+' : ''}${fmt(delta)})` : 'Sin diferencias'))
      setCount(null)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar el recuento')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40'
  const places = [{ id: LOCAL, name: 'Local' }, ...warehouses]

  return (
    <div className="animate-fade-in space-y-6 max-w-6xl mx-auto w-full pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <WarehouseIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Depósitos</h1>
            <p className="text-sm text-white/40">El Local es lo que se vende. Guardá mercadería en tus depósitos y traela cuando la necesites.</p>
          </div>
        </div>
        <button onClick={() => setNameModal({ name: '' })} className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nuevo depósito
        </button>
      </div>

      {loading ? (
        <div className="h-48 grid place-items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <WarehouseIcon className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold">Todavía no tenés depósitos</p>
          <p className="text-sm text-white/40 mt-1">Creá uno (por ejemplo "Depósito trasero" o "Galpón") y pasale mercadería desde el Local.</p>
          <button onClick={() => setNameModal({ name: '' })} className="mt-5 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110">Crear el primero</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((warehouse) => (
              <div key={warehouse.id} className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{warehouse.name}</p>
                  <p className="text-xs text-white/45 mt-0.5">{fmt(warehouseTotals.get(warehouse.id) ?? 0)} unidades guardadas</p>
                </div>
                <button onClick={() => setNameModal({ id: warehouse.id, name: warehouse.name })} className="w-8 h-8 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 flex items-center justify-center" aria-label="Renombrar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeWarehouse(warehouse)} className="w-8 h-8 rounded-lg bg-white/5 text-red-300/70 hover:bg-red-500/10 flex items-center justify-center" aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE) }} placeholder="Buscar producto o código" className={cn(input, 'pl-9')} />
            </div>
            <select value={view} onChange={(e) => { setView(e.target.value); setLimit(PAGE_SIZE) }} className={cn(input, 'sm:w-64')}>
              <option value="all" className="bg-[#07142f]">Todos los productos</option>
              {places.map(p => <option key={p.id} value={p.id} className="bg-[#07142f]">Con stock en {p.name}</option>)}
            </select>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/45 border-b border-white/8">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  {places.map(p => <th key={p.id} className="px-3 py-3 font-semibold text-right whitespace-nowrap">{p.name}</th>)}
                  <th className="px-3 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((product) => (
                  <tr key={product.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <p className="text-white font-medium">{product.name}</p>
                      {product.barcode && <p className="text-[11px] text-white/35">{product.barcode}</p>}
                    </td>
                    {places.map(p => {
                      const qty = qtyIn(product, p.id)
                      return (
                        <td key={p.id} className={cn('px-3 py-2.5 text-right tabular-nums', qty < 0 ? 'text-red-300' : qty === 0 ? 'text-white/25' : 'text-white/85')}>
                          {fmt(qty)}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums text-white font-semibold">{fmt(Number(product.stock) || 0)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setMove({ product, from: LOCAL, to: warehouses[0].id, quantity: '' })}
                          className="h-8 px-2.5 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Mover
                        </button>
                        <button
                          onClick={() => setCount({ product, warehouseId: view !== 'all' && view !== LOCAL ? view : warehouses[0].id, quantity: '' })}
                          className="h-8 px-2.5 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Contar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="p-8 text-center text-sm text-white/40">No hay productos para mostrar.</p>}
          </div>
          {filtered.length > limit && (
            <div className="text-center">
              <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="h-9 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">
                Ver más ({filtered.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      )}

      <Modal open={!!nameModal} onClose={() => setNameModal(null)} title={nameModal?.id ? 'Renombrar depósito' : 'Nuevo depósito'}>
        <div className="space-y-4">
          <input
            autoFocus
            value={nameModal?.name ?? ''}
            onChange={(e) => setNameModal(m => m && { ...m, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
            placeholder="Ej: Depósito trasero"
            maxLength={60}
            className={input}
          />
          <button onClick={saveName} disabled={saving} className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </Modal>

      <Modal open={!!move} onClose={() => setMove(null)} title={move ? `Mover ${move.product.name}` : ''}>
        {move && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-white/50 space-y-1.5">
                <span>Desde</span>
                <select value={move.from} onChange={(e) => setMove({ ...move, from: e.target.value })} className={input}>
                  {places.map(p => <option key={p.id} value={p.id} className="bg-[#07142f]">{p.name} ({fmt(qtyIn(move.product, p.id))})</option>)}
                </select>
              </label>
              <label className="text-xs text-white/50 space-y-1.5">
                <span>Hacia</span>
                <select value={move.to} onChange={(e) => setMove({ ...move, to: e.target.value })} className={input}>
                  {places.map(p => <option key={p.id} value={p.id} className="bg-[#07142f]">{p.name} ({fmt(qtyIn(move.product, p.id))})</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-white/50 space-y-1.5">
              <span>Cantidad</span>
              <input type="number" min={0} autoFocus value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} className={input} />
            </label>
            <p className="text-xs text-white/40">El stock total no cambia: solo cambia dónde está la mercadería.</p>
            <button onClick={submitMove} disabled={saving} className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              Mover
            </button>
          </div>
        )}
      </Modal>

      <Modal open={!!count} onClose={() => setCount(null)} title={count ? `Recuento de ${count.product.name}` : ''}>
        {count && (
          <div className="space-y-4">
            <label className="block text-xs text-white/50 space-y-1.5">
              <span>Depósito</span>
              <select value={count.warehouseId} onChange={(e) => setCount({ ...count, warehouseId: e.target.value })} className={input}>
                {warehouses.map(w => <option key={w.id} value={w.id} className="bg-[#07142f]">{w.name} (hoy {fmt(qtyIn(count.product, w.id))})</option>)}
              </select>
            </label>
            <label className="block text-xs text-white/50 space-y-1.5">
              <span>Cantidad contada</span>
              <input type="number" min={0} autoFocus value={count.quantity} onChange={(e) => setCount({ ...count, quantity: e.target.value })} className={input} />
            </label>
            <p className="text-xs text-white/40">La diferencia con lo que figura se suma o se resta del stock total del producto.</p>
            <button onClick={submitCount} disabled={saving} className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              Guardar recuento
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Tag, Pencil, Trash2, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalProducts } from '@/sync/storage'
import { withSyncNote } from '@/sync/connectivity'
import Modal from '@/components/ui/Modal'
import { cn, formatCurrency } from '@/lib/utils'
import {
  describePromotion,
  isPromotionActive,
  promotionDiscount,
  type Promotion,
  type PromotionKind,
} from '@/features/promotions/promotionEngine'
import type { Category, Product } from '@/types/database'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const KIND_OPTIONS: { value: PromotionKind; label: string; hint: string }[] = [
  { value: 'nxm', label: 'Llevá N, pagá M', hint: '2x1, 3x2, 4x3…' },
  { value: 'percent', label: '% de descuento', hint: 'Por ejemplo 15% off' },
  { value: 'second_unit', label: '2da unidad con descuento', hint: 'Por ejemplo 2da al 50%' },
]

type Scope = 'all' | 'category' | 'products'

interface PromotionForm {
  id?: string
  name: string
  kind: PromotionKind
  buy_qty: string
  pay_qty: string
  percent: string
  scope: Scope
  category_id: string
  product_ids: string[]
  starts_on: string
  ends_on: string
  weekdays: number[]
  active: boolean
}

const emptyForm: PromotionForm = {
  name: '', kind: 'nxm', buy_qty: '2', pay_qty: '1', percent: '15', scope: 'products',
  category_id: '', product_ids: [], starts_on: '', ends_on: '', weekdays: [], active: true,
}

function statusOf(promotion: Promotion): { label: string; className: string } {
  if (!promotion.active) return { label: 'Pausada', className: 'bg-white/5 text-white/40 border-white/10' }
  const today = new Date()
  if (isPromotionActive(promotion, today)) return { label: 'Vigente hoy', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
  const key = today.toISOString().slice(0, 10)
  if (promotion.ends_on && key > promotion.ends_on) return { label: 'Vencida', className: 'bg-red-500/10 text-red-400 border-red-500/20' }
  return { label: 'Programada', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
}

export default function PromotionsPage() {
  const { profile } = useAuthStore()
  const businessId = profile?.business_id
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<PromotionForm>(emptyForm)
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!businessId) return
    try {
      const [promos, prods, cats] = await Promise.all([
        syncEngine.pullRows<Promotion>('promotions', businessId, () =>
          (supabase as any).from('promotions').select('*').eq('business_id', businessId)),
        getLocalProducts(businessId),
        syncEngine.pullRows<Category>('categories', businessId, () =>
          supabase.from('categories').select('*').eq('business_id', businessId)),
      ])
      setPromotions([...promos].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))))
      setProducts((prods as unknown as Product[]).filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setCategories([...cats].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    } catch (error) {
      console.error('[Promotions] load failed:', error)
      toast.error('No se pudieron cargar las promociones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!businessId) return
    load()
    return syncEngine.onSynced(() => { load() })
  }, [businessId])

  const productNames = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products])
  const categoryNames = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])

  const productMatches = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return []
    return products
      .filter(p => !form.product_ids.includes(p.id) && (p.name.toLowerCase().includes(term) || p.barcode?.includes(term)))
      .slice(0, 8)
  }, [productSearch, products, form.product_ids])

  function scopeLabel(promotion: Promotion): string {
    if (promotion.product_ids?.length) {
      const names = promotion.product_ids.map(id => productNames.get(id) ?? 'Producto').slice(0, 3)
      const extra = promotion.product_ids.length - names.length
      return names.join(', ') + (extra > 0 ? ` y ${extra} más` : '')
    }
    if (promotion.category_id) return `Categoría ${categoryNames.get(promotion.category_id) ?? ''}`
    return 'Todos los productos'
  }

  function openNew() {
    setForm(emptyForm)
    setProductSearch('')
    setShowModal(true)
  }

  function openEdit(promotion: Promotion) {
    setForm({
      id: promotion.id,
      name: promotion.name,
      kind: promotion.kind,
      buy_qty: String(promotion.buy_qty ?? 2),
      pay_qty: String(promotion.pay_qty ?? 1),
      percent: String(promotion.percent ?? 15),
      scope: promotion.product_ids?.length ? 'products' : promotion.category_id ? 'category' : 'all',
      category_id: promotion.category_id ?? '',
      product_ids: promotion.product_ids ?? [],
      starts_on: promotion.starts_on ?? '',
      ends_on: promotion.ends_on ?? '',
      weekdays: promotion.weekdays ?? [],
      active: promotion.active,
    })
    setProductSearch('')
    setShowModal(true)
  }

  function buildValues(): Omit<Promotion, 'id'> | string {
    if (!form.name.trim()) return 'Poné un nombre a la promoción'
    const buy = Number(form.buy_qty)
    const pay = Number(form.pay_qty)
    const percent = Number(form.percent)
    if (form.kind === 'nxm' && (!Number.isInteger(buy) || !Number.isInteger(pay) || buy < 2 || pay < 1 || pay >= buy)) {
      return 'En "Llevá N, pagá M", N tiene que ser mayor que M (por ejemplo 2 y 1)'
    }
    if (form.kind !== 'nxm' && !(percent > 0 && percent <= 100)) return 'El porcentaje tiene que estar entre 1 y 100'
    if (form.scope === 'category' && !form.category_id) return 'Elegí la categoría'
    if (form.scope === 'products' && form.product_ids.length === 0) return 'Agregá al menos un producto'
    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) return 'La fecha de fin es anterior a la de inicio'
    return {
      name: form.name.trim(),
      kind: form.kind,
      buy_qty: form.kind === 'nxm' ? buy : null,
      pay_qty: form.kind === 'nxm' ? pay : null,
      percent: form.kind === 'nxm' ? null : percent,
      product_ids: form.scope === 'products' ? form.product_ids : null,
      category_id: form.scope === 'category' ? form.category_id : null,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      weekdays: form.weekdays.length ? [...form.weekdays].sort() : null,
      active: form.active,
    }
  }

  async function save() {
    if (!businessId) return
    const values = buildValues()
    if (typeof values === 'string') { toast.error(values); return }
    setSaving(true)
    try {
      if (form.id) {
        await syncEngine.updateRow('promotions', businessId, form.id, { ...values, updated_at: new Date().toISOString() })
      } else {
        await syncEngine.createRow('promotions', businessId, { ...values, id: crypto.randomUUID(), created_at: new Date().toISOString() })
      }
      toast.success(withSyncNote(form.id ? 'Promoción actualizada' : 'Promoción creada'))
      setShowModal(false)
      load()
    } catch (error) {
      console.error('[Promotions] save failed:', error)
      toast.error('No se pudo guardar la promoción')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(promotion: Promotion) {
    if (!businessId) return
    await syncEngine.updateRow('promotions', businessId, promotion.id, { active: !promotion.active, updated_at: new Date().toISOString() })
    toast.success(withSyncNote(promotion.active ? 'Promoción pausada' : 'Promoción activada'))
    load()
  }

  async function remove(promotion: Promotion) {
    if (!businessId || !confirm(`¿Eliminar la promoción "${promotion.name}"?`)) return
    await syncEngine.deleteRow('promotions', businessId, promotion.id)
    toast.success(withSyncNote('Promoción eliminada'))
    load()
  }

  // Ejemplo en vivo de cuánto descuenta, con un producto de $1.000.
  const preview = (() => {
    const values = buildValues()
    if (typeof values === 'string') return null
    const sample = { ...values, id: 'preview' } as Promotion
    const qty = form.kind === 'nxm' ? Number(form.buy_qty) : 2
    return { qty, discount: promotionDiscount(sample, qty, 1000) }
  })()

  const input = 'w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40'

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Promociones</h1>
            <p className="text-sm text-white/40">Se aplican solas en el punto de venta, también sin internet.</p>
          </div>
        </div>
        <button onClick={openNew} className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nueva promoción
        </button>
      </div>

      {loading ? (
        <div className="h-48 grid place-items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : promotions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <Tag className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold">Todavía no tenés promociones</p>
          <p className="text-sm text-white/40 mt-1">Creá un 2x1, un % off por categoría o la 2da unidad al 50%.</p>
          <button onClick={openNew} className="mt-5 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110">Crear la primera</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {promotions.map((promotion) => {
            const status = statusOf(promotion)
            return (
              <div key={promotion.id} className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{promotion.name}</p>
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">{describePromotion(promotion)}</span>
                    <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-bold', status.className)}>{status.label}</span>
                  </div>
                  <p className="text-xs text-white/45 mt-1 truncate">{scopeLabel(promotion)}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {promotion.starts_on || promotion.ends_on
                      ? `${promotion.starts_on ? `Desde ${promotion.starts_on.split('-').reverse().join('/')}` : ''}${promotion.ends_on ? ` hasta ${promotion.ends_on.split('-').reverse().join('/')}` : ''}`
                      : 'Sin fecha de fin'}
                    {promotion.weekdays?.length ? ` · ${promotion.weekdays.map(d => WEEKDAYS[d]).join(', ')}` : ' · Todos los días'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(promotion)} className="h-8 px-3 rounded-lg bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10">
                    {promotion.active ? 'Pausar' : 'Activar'}
                  </button>
                  <button onClick={() => openEdit(promotion)} className="w-8 h-8 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 flex items-center justify-center" aria-label="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(promotion)} className="w-8 h-8 rounded-lg bg-white/5 text-red-300/70 hover:bg-red-500/10 flex items-center justify-center" aria-label="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar promoción' : 'Nueva promoción'} size="lg">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Nombre (se ve en el ticket)</label>
            <input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="2x1 en gaseosas" />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Tipo</label>
            <div className="grid sm:grid-cols-3 gap-2">
              {KIND_OPTIONS.map(option => (
                <button key={option.value} type="button" onClick={() => setForm({ ...form, kind: option.value })}
                  className={cn('text-left rounded-xl border p-3', form.kind === option.value ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')}>
                  <p className="text-sm font-bold text-white">{option.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {form.kind === 'nxm' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Llevá</label>
                <input type="number" min={2} className={input} value={form.buy_qty} onChange={e => setForm({ ...form, buy_qty: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Pagá</label>
                <input type="number" min={1} className={input} value={form.pay_qty} onChange={e => setForm({ ...form, pay_qty: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="max-w-[200px]">
              <label className="block text-xs font-medium text-white/60 mb-1">
                {form.kind === 'percent' ? '% de descuento' : '% de descuento en la 2da unidad'}
              </label>
              <input type="number" min={1} max={100} className={input} value={form.percent} onChange={e => setForm({ ...form, percent: e.target.value })} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">¿A qué productos aplica?</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {([['products', 'Productos elegidos'], ['category', 'Una categoría'], ['all', 'Todo el catálogo']] as [Scope, string][]).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setForm({ ...form, scope: value })}
                  className={cn('h-8 px-3 rounded-lg text-xs font-semibold border', form.scope === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60 hover:bg-white/5')}>
                  {label}
                </button>
              ))}
            </div>

            {form.scope === 'category' && (
              <select className={input} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="" className="bg-slate-900">Elegí una categoría</option>
                {categories.map(category => <option key={category.id} value={category.id} className="bg-slate-900">{category.name}</option>)}
              </select>
            )}

            {form.scope === 'products' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-white/30 absolute left-3 top-3" />
                  <input className={cn(input, 'pl-9')} value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Buscá por nombre o código" />
                  {productMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/10 bg-[#0b1626] shadow-xl overflow-hidden">
                      {productMatches.map(product => (
                        <button key={product.id} type="button"
                          onClick={() => { setForm({ ...form, product_ids: [...form.product_ids, product.id] }); setProductSearch('') }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5">
                          <span className="truncate">{product.name}</span>
                          <span className="text-xs text-white/40 shrink-0 ml-2">{formatCurrency(product.sale_price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.product_ids.map(id => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 pl-2 pr-1 py-1 text-xs text-white/80">
                      {productNames.get(id) ?? 'Producto'}
                      <button type="button" onClick={() => setForm({ ...form, product_ids: form.product_ids.filter(p => p !== id) })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10" aria-label="Quitar">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Desde (opcional)</label>
              <input type="date" className={input} value={form.starts_on} onChange={e => setForm({ ...form, starts_on: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Hasta (opcional)</label>
              <input type="date" className={input} value={form.ends_on} onChange={e => setForm({ ...form, ends_on: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Días (si no elegís ninguno, todos los días)</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day, index) => {
                const selected = form.weekdays.includes(index)
                return (
                  <button key={day} type="button"
                    onClick={() => setForm({ ...form, weekdays: selected ? form.weekdays.filter(d => d !== index) : [...form.weekdays, index] })}
                    className={cn('h-8 w-12 rounded-lg text-xs font-semibold border', selected ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60 hover:bg-white/5')}>
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Activa
          </label>

          {preview && preview.discount > 0 && (
            <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
              Ejemplo: {preview.qty} unidades de un producto de $1.000 → descuento de {formatCurrency(preview.discount)}.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowModal(false)} className="h-10 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">Cancelar</button>
            <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

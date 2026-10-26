import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Gift, Plus, Pencil, Trash2, Search, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalProducts } from '@/sync/storage'
import { isOnline, withSyncNote } from '@/sync/connectivity'
import Modal from '@/components/ui/Modal'
import { cn, formatCurrency } from '@/lib/utils'
import { readLoyaltyConfig, type LoyaltyReward, type RewardKind } from '@/features/loyalty/loyalty'
import type { Customer, Product } from '@/types/database'

interface RewardForm {
  id?: string
  name: string
  points_cost: string
  kind: RewardKind
  product_id: string
  percent: string
  active: boolean
}

const emptyReward: RewardForm = { name: '', points_cost: '100', kind: 'product', product_id: '', percent: '10', active: true }

export default function LoyaltyPage() {
  const { profile } = useAuthStore()
  const { business, updateBusiness } = useBusinessStore()
  const businessId = profile?.business_id
  const config = readLoyaltyConfig((business as any)?.loyalty_config)

  const [enabled, setEnabled] = useState(config.enabled)
  const [amountPerPoint, setAmountPerPoint] = useState(String(config.amount_per_point))
  const [rewards, setRewards] = useState<LoyaltyReward[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [rewardModal, setRewardModal] = useState(false)
  const [rewardForm, setRewardForm] = useState<RewardForm>(emptyReward)
  const [adjusting, setAdjusting] = useState<Customer | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  useEffect(() => {
    setEnabled(config.enabled)
    setAmountPerPoint(String(config.amount_per_point))
  }, [config.enabled, config.amount_per_point])

  async function load() {
    if (!businessId) return
    const [rewardRows, customerRows, productRows] = await Promise.all([
      syncEngine.pullRows<LoyaltyReward>('loyalty_rewards', businessId, () =>
        (supabase as any).from('loyalty_rewards').select('*').eq('business_id', businessId)),
      syncEngine.pullLatestCustomers(businessId),
      getLocalProducts(businessId),
    ])
    setRewards([...rewardRows].sort((a, b) => a.points_cost - b.points_cost))
    setCustomers(customerRows as unknown as Customer[])
    setProducts((productRows as unknown as Product[]).filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es')))
  }

  useEffect(() => {
    if (!businessId) return
    load()
    return syncEngine.onSynced(() => { load() })
  }, [businessId])

  const ranking = useMemo(() => {
    const term = search.trim().toLowerCase()
    return customers
      .filter(c => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => (Number((b as any).loyalty_points) || 0) - (Number((a as any).loyalty_points) || 0))
      .slice(0, 100)
  }, [customers, search])

  const productNames = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  async function saveConfig() {
    const amount = Number(amountPerPoint)
    if (!(amount > 0)) { toast.error('Indicá cada cuántos pesos se suma un punto'); return }
    if (!isOnline()) { toast.error('Guardar la configuración del club necesita conexión'); return }
    await updateBusiness({ loyalty_config: { enabled, amount_per_point: amount } } as any)
    toast.success(enabled ? 'Club de puntos activado' : 'Club de puntos desactivado')
  }

  function openReward(reward?: LoyaltyReward) {
    setRewardForm(reward ? {
      id: reward.id,
      name: reward.name,
      points_cost: String(reward.points_cost),
      kind: reward.kind,
      product_id: reward.product_id ?? '',
      percent: String(reward.percent ?? 10),
      active: reward.active,
    } : emptyReward)
    setRewardModal(true)
  }

  async function saveReward() {
    if (!businessId) return
    const points = Math.floor(Number(rewardForm.points_cost))
    const percent = Number(rewardForm.percent)
    if (!rewardForm.name.trim()) { toast.error('Poné un nombre al premio'); return }
    if (!(points > 0)) { toast.error('Los puntos tienen que ser mayores a cero'); return }
    if (rewardForm.kind === 'product' && !rewardForm.product_id) { toast.error('Elegí el producto'); return }
    if (rewardForm.kind === 'percent' && !(percent > 0 && percent <= 100)) { toast.error('El descuento tiene que estar entre 1 y 100%'); return }
    const values = {
      name: rewardForm.name.trim(),
      points_cost: points,
      kind: rewardForm.kind,
      product_id: rewardForm.kind === 'product' ? rewardForm.product_id : null,
      percent: rewardForm.kind === 'percent' ? percent : null,
      active: rewardForm.active,
    }
    if (rewardForm.id) await syncEngine.updateRow('loyalty_rewards', businessId, rewardForm.id, values)
    else await syncEngine.createRow('loyalty_rewards', businessId, { ...values, id: crypto.randomUUID(), created_at: new Date().toISOString() })
    toast.success(withSyncNote('Premio guardado'))
    setRewardModal(false)
    load()
  }

  async function removeReward(reward: LoyaltyReward) {
    if (!businessId || !confirm(`¿Eliminar el premio "${reward.name}"?`)) return
    await syncEngine.deleteRow('loyalty_rewards', businessId, reward.id)
    toast.success(withSyncNote('Premio eliminado'))
    load()
  }

  async function saveAdjustment() {
    if (!businessId || !adjusting) return
    const points = Math.trunc(Number(adjustPoints))
    if (!points) { toast.error('Indicá los puntos a sumar (o negativos para restar)'); return }
    await syncEngine.recordLoyaltyMovement(businessId, {
      customer_id: adjusting.id,
      sale_id: null,
      points,
      kind: 'adjust',
      description: adjustReason.trim() || 'Ajuste manual',
    })
    toast.success(withSyncNote('Puntos ajustados'))
    setAdjusting(null)
    setAdjustPoints('')
    setAdjustReason('')
    load()
  }

  const input = 'w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40'

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Gift className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Club de puntos</h1>
          <p className="text-sm text-white/40">Tus clientes suman puntos con cada compra y los canjean en la caja.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-4">
        <h2 className="font-semibold text-white">Configuración</h2>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Club activo
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="block text-xs font-medium text-white/60 mb-1">1 punto cada ($)</label>
            <input type="number" min={1} className={input} value={amountPerPoint} onChange={e => setAmountPerPoint(e.target.value)} />
          </div>
          <p className="text-xs text-white/40 pb-3">
            Ejemplo: una compra de {formatCurrency(25000)} suma {Number(amountPerPoint) > 0 ? Math.floor(25000 / Number(amountPerPoint)) : 0} puntos.
          </p>
        </div>
        <button onClick={saveConfig} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110">Guardar configuración</button>
      </section>

      <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Premios</h2>
          <button onClick={() => openReward()} className="h-9 px-3 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nuevo premio
          </button>
        </div>
        {rewards.length === 0 ? (
          <p className="text-sm text-white/40">Cargá premios como "Café gratis por 100 puntos" o "15% de descuento por 300 puntos".</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rewards.map(reward => (
              <div key={reward.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', reward.active ? 'text-white' : 'text-white/40')}>{reward.name}{!reward.active && ' (pausado)'}</p>
                  <p className="text-xs text-white/40">
                    {reward.points_cost} pts · {reward.kind === 'product'
                      ? `${productNames.get(reward.product_id ?? '')?.name ?? 'Producto'} gratis`
                      : `${reward.percent}% de descuento en la compra`}
                  </p>
                </div>
                <button onClick={() => openReward(reward)} className="w-8 h-8 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 flex items-center justify-center" aria-label="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeReward(reward)} className="w-8 h-8 rounded-lg bg-white/5 text-red-300/70 hover:bg-red-500/10 flex items-center justify-center" aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-white flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Clientes con más puntos</h2>
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-3" />
            <input className={cn(input, 'pl-9')} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente" />
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {ranking.map((customer, index) => (
            <div key={customer.id} className="flex items-center gap-3 py-2">
              <span className="w-6 text-xs text-white/30 tabular-nums">{index + 1}</span>
              <span className="flex-1 truncate text-sm text-white/80">{customer.name}</span>
              <span className="text-sm font-bold text-amber-300 tabular-nums">{Number((customer as any).loyalty_points) || 0} pts</span>
              <button onClick={() => setAdjusting(customer)} className="h-8 px-2.5 rounded-lg bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10">Ajustar</button>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-sm text-white/40 py-2">Sin clientes.</p>}
        </div>
      </section>

      <Modal open={rewardModal} onClose={() => setRewardModal(false)} title={rewardForm.id ? 'Editar premio' : 'Nuevo premio'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Nombre</label>
            <input className={input} value={rewardForm.name} onChange={e => setRewardForm({ ...rewardForm, name: e.target.value })} placeholder="Café gratis" />
          </div>
          <div className="flex gap-2">
            {([['product', 'Producto gratis'], ['percent', '% de descuento']] as [RewardKind, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setRewardForm({ ...rewardForm, kind: value })}
                className={cn('h-9 px-3 rounded-lg text-xs font-semibold border', rewardForm.kind === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60 hover:bg-white/5')}>
                {label}
              </button>
            ))}
          </div>
          {rewardForm.kind === 'product' ? (
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Producto (una unidad gratis)</label>
              <select className={input} value={rewardForm.product_id} onChange={e => setRewardForm({ ...rewardForm, product_id: e.target.value })}>
                <option value="" className="bg-slate-900">Elegí un producto</option>
                {products.map(product => <option key={product.id} value={product.id} className="bg-slate-900">{product.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="w-40">
              <label className="block text-xs font-medium text-white/60 mb-1">% de descuento</label>
              <input type="number" min={1} max={100} className={input} value={rewardForm.percent} onChange={e => setRewardForm({ ...rewardForm, percent: e.target.value })} />
            </div>
          )}
          <div className="w-40">
            <label className="block text-xs font-medium text-white/60 mb-1">Puntos necesarios</label>
            <input type="number" min={1} className={input} value={rewardForm.points_cost} onChange={e => setRewardForm({ ...rewardForm, points_cost: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={rewardForm.active} onChange={e => setRewardForm({ ...rewardForm, active: e.target.checked })} /> Activo
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRewardModal(false)} className="h-10 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">Cancelar</button>
            <button onClick={saveReward} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110">Guardar</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Ajustar puntos · ${adjusting?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-white/60">Saldo actual: <b className="text-white">{Number((adjusting as any)?.loyalty_points) || 0} pts</b></p>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Puntos (negativo para restar)</label>
            <input type="number" className={input} value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Motivo</label>
            <input className={input} value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Bienvenida al club" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdjusting(null)} className="h-10 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">Cancelar</button>
            <button onClick={saveAdjustment} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110">Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

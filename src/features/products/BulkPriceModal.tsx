import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { cn, formatCurrency } from '@/lib/utils'
import { syncEngine } from '@/sync/syncEngine'
import { withSyncNote } from '@/sync/connectivity'
import { planPriceChanges, type PriceChangeMode, type PriceRounding, type PriceTarget } from './bulkPricing'
import type { Product } from '@/types/database'

const ROUNDING_OPTIONS: { value: PriceRounding; label: string }[] = [
  { value: 0, label: 'Sin redondeo' },
  { value: 10, label: 'A $10' },
  { value: 50, label: 'A $50' },
  { value: 100, label: 'A $100' },
]

export default function BulkPriceModal({
  open,
  onClose,
  products,
  businessId,
  onDone,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  businessId: string
  onDone: () => void
}) {
  const [mode, setMode] = useState<PriceChangeMode>('percent')
  const [value, setValue] = useState('10')
  const [target, setTarget] = useState<PriceTarget>('sale')
  const [rounding, setRounding] = useState<PriceRounding>(0)
  const [saving, setSaving] = useState(false)

  const numericValue = Number(value.replace(',', '.'))
  const changes = useMemo(
    () => (Number.isFinite(numericValue) ? planPriceChanges(products, { mode, value: numericValue, target, rounding }) : []),
    [products, mode, numericValue, target, rounding]
  )
  const changed = changes.filter((c) => c.newSale !== c.oldSale || c.newCost !== c.oldCost)

  async function apply() {
    if (!Number.isFinite(numericValue) || numericValue === 0) { toast.error('Ingresá cuánto querés cambiar'); return }
    if (changed.length === 0) { toast.info('No hay precios para cambiar'); return }
    const verb = numericValue > 0 ? 'Aumentar' : 'Bajar'
    if (!confirm(`¿${verb} ${changed.length} precio(s)?`)) return
    setSaving(true)
    try {
      for (const change of changed) {
        const values: Record<string, number> = {}
        if (change.newSale !== change.oldSale) values.sale_price = change.newSale
        // El costo de reposición también actualiza el costo promedio (igual que al editar el producto).
        if (change.newCost !== change.oldCost) { values.purchase_price = change.newCost; values.avg_cost = change.newCost }
        await syncEngine.updateRow('products', businessId, change.id, values)
      }
      toast.success(withSyncNote(`${changed.length} precio(s) actualizados`))
      onDone()
      onClose()
    } catch (error) {
      console.error('[BulkPrice] failed:', error)
      toast.error('No se pudieron guardar todos los precios')
    } finally {
      setSaving(false)
    }
  }

  const chip = (selected: boolean) => cn('h-8 px-3 rounded-lg text-xs font-semibold border', selected ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60 hover:bg-white/5')

  return (
    <Modal open={open} onClose={onClose} title={`Cambiar precios · ${products.length} producto(s)`} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(mode === 'percent')} onClick={() => setMode('percent')}>Porcentaje</button>
          <button type="button" className={chip(mode === 'amount')} onClick={() => setMode('amount')}>Monto fijo</button>
        </div>

        <div className="max-w-[240px]">
          <label className="block text-xs font-medium text-white/60 mb-1">
            {mode === 'percent' ? 'Porcentaje (negativo para bajar)' : 'Pesos a sumar (negativo para restar)'}
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-2">¿Qué precio cambia?</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(target === 'sale')} onClick={() => setTarget('sale')}>Precio de venta</button>
            <button type="button" className={chip(target === 'cost')} onClick={() => setTarget('cost')}>Costo</button>
            <button type="button" className={chip(target === 'both')} onClick={() => setTarget('both')}>Los dos</button>
          </div>
        </div>

        {target !== 'cost' && (
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Redondear el precio de venta hacia arriba</label>
            <div className="flex flex-wrap gap-2">
              {ROUNDING_OPTIONS.map((option) => (
                <button key={option.value} type="button" className={chip(rounding === option.value)} onClick={() => setRounding(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-white/40">
            <span>Producto</span><span>Antes</span><span>Después</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {changes.slice(0, 50).map((change) => (
              <div key={change.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-xs">
                <span className="truncate text-white/80">{change.name}</span>
                <span className="text-white/40 tabular-nums text-right">
                  {target !== 'cost' && formatCurrency(change.oldSale)}
                  {target === 'both' && <br />}
                  {target !== 'sale' && <span className="text-white/30">costo {formatCurrency(change.oldCost)}</span>}
                </span>
                <span className="text-white font-semibold tabular-nums text-right">
                  {target !== 'cost' && formatCurrency(change.newSale)}
                  {target === 'both' && <br />}
                  {target !== 'sale' && <span className="text-white/60">costo {formatCurrency(change.newCost)}</span>}
                </span>
              </div>
            ))}
          </div>
          {changes.length > 50 && <p className="px-3 py-2 text-[11px] text-white/30">y {changes.length - 50} producto(s) más</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">Cancelar</button>
          <button onClick={apply} disabled={saving || changed.length === 0} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
            {saving ? 'Guardando...' : `Aplicar a ${changed.length}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

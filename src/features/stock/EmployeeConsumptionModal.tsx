import { useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import { syncEngine } from '@/sync/syncEngine'
import { withSyncNote } from '@/sync/connectivity'
import type { CartItem } from '@/types/database'
import { CONSUMPTION_NOTE } from './consumption'

/** Retiro de mercadería sin venta (consumo del personal): descuenta stock y queda registrado al costo. */
export default function EmployeeConsumptionModal({
  open,
  onClose,
  items,
  businessId,
  defaultName,
  onDone,
}: {
  open: boolean
  onClose: () => void
  items: CartItem[]
  businessId: string
  defaultName: string
  onDone: () => void
}) {
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const cost = items.reduce((sum, item) => sum + (Number(item.product.purchase_price) || 0) * item.quantity, 0)

  async function confirm() {
    const employee = name.trim()
    if (!employee) { toast.error('Poné quién retira la mercadería'); return }
    setSaving(true)
    try {
      for (const item of items) {
        await syncEngine.adjustStock(businessId, item.product.id, -item.quantity, 'adjustment', `${CONSUMPTION_NOTE}: ${employee}`)
      }
      toast.success(withSyncNote('Consumo registrado'))
      onDone()
      onClose()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo registrar el consumo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Consumo de empleado">
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Se descuenta el stock de {items.length} producto(s) sin cobrar ni facturar. Queda en el cierre de caja al costo ({formatCurrency(cost)}).
        </p>
        <label className="block text-xs text-white/50 space-y-1.5">
          <span>¿Quién lo retira?</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm() }}
            maxLength={60}
            className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40"
          />
        </label>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
          {items.map((item) => (
            <div key={item.product.id} className="flex justify-between gap-3 px-3 py-2 text-xs">
              <span className="truncate text-white/80">{item.product.name}</span>
              <span className="text-white/50 tabular-nums">× {item.quantity}</span>
            </div>
          ))}
        </div>
        <button onClick={confirm} disabled={saving} className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Registrar consumo'}
        </button>
      </div>
    </Modal>
  )
}

import { formatCurrency } from '@/lib/utils'
import type { ConsumptionLine, ProductSummary } from './sessionProducts'

const fmtQty = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })

/** Detalle del cierre: productos vendidos y consumos de empleados del turno. */
export default function SessionProductsPanel({ sold, consumption }: { sold: ProductSummary[]; consumption: ConsumptionLine[] }) {
  const units = sold.reduce((s, p) => s + p.quantity, 0)
  const consumptionCost = consumption.reduce((s, c) => s + c.cost, 0)

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-semibold text-white">Productos vendidos</p>
          <p className="text-xs text-white/40">{sold.length} productos · {fmtQty(units)} unidades</p>
        </div>
        {sold.length === 0 ? (
          <p className="text-sm text-white/35 py-4 text-center">Sin ventas en este turno.</p>
        ) : (
          <div className="rounded-xl border border-white/8 max-h-80 overflow-y-auto divide-y divide-white/5">
            {sold.map((p) => (
              <div key={p.product_id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-xs">
                <span className="truncate text-white/85">{p.name}</span>
                <span className="text-white/50 tabular-nums text-right">× {fmtQty(p.quantity)}</span>
                <span className="text-white font-semibold tabular-nums text-right w-24">{formatCurrency(p.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {consumption.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-semibold text-white">Consumo de empleados</p>
            <p className="text-xs text-white/40">al costo {formatCurrency(consumptionCost)}</p>
          </div>
          <div className="rounded-xl border border-white/8 max-h-48 overflow-y-auto divide-y divide-white/5">
            {consumption.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-xs">
                <span className="truncate text-white/85">{c.name} <span className="text-white/40">· {c.employee}</span></span>
                <span className="text-white/50 tabular-nums text-right">× {fmtQty(c.quantity)}</span>
                <span className="text-white/70 tabular-nums text-right w-24">{formatCurrency(c.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

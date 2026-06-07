import { useEffect, useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import { fetchTopSellingProducts } from './insightsService'
import { useBusinessStore } from '@/stores/businessStore'
import { formatCurrency } from '@/lib/utils'
import type { TopSellingProduct } from '@/types/database'

type Period = 1 | 7 | 30

const PERIOD_LABELS: Record<Period, string> = {
  1: 'Hoy',
  7: '7 días',
  30: 'Mes',
}

interface InsightsCardProps {
  compact?: boolean
}

export default function InsightsCard({ compact = false }: InsightsCardProps) {
  const { business } = useBusinessStore()
  const [period, setPeriod] = useState<Period>(7)
  const [items, setItems] = useState<TopSellingProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!business?.id) return
    setLoading(true)
    fetchTopSellingProducts(business.id, period, compact ? 5 : 10)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [business?.id, period])

  const max = items[0]?.total_qty ?? 1

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-[13px] font-semibold text-white">Top vendidos</p>
        </div>
        <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {([1, 7, 30] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-[11px] font-medium transition ${
                period === p ? 'bg-primary/20 text-primary' : 'text-white/50 hover:text-white'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-[13px] text-white/30 py-6">Sin ventas en el período</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.product_id} className="flex items-center gap-2.5">
              <span className="text-[11px] text-white/30 font-mono w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-medium text-white truncate">{item.product_name}</p>
                  <p className="text-[11px] text-white/50 shrink-0 ml-2">{item.total_qty} u.</p>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${(item.total_qty / max) * 100}%` }}
                  />
                </div>
              </div>
              {!compact && (
                <p className="text-[11px] text-white/40 w-16 text-right shrink-0">{formatCurrency(item.total_revenue)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

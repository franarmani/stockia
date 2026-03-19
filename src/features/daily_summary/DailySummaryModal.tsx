import { useState, useEffect } from 'react'
import { X, Download, MessageCircle, TrendingUp, ShoppingCart, DollarSign, Package, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { generateDailySummary, buildWhatsAppText, exportSummaryCSV } from './dailySummaryService'
import { useBusinessStore } from '@/stores/businessStore'
import type { DailySummary } from '@/types/database'

interface DailySummaryModalProps {
  onClose: () => void
  date?: string
}

export default function DailySummaryModal({ onClose, date }: DailySummaryModalProps) {
  const { business } = useBusinessStore()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!business?.id) return
      setLoading(true)
      try {
        const s = await generateDailySummary(business.id, date)
        setSummary(s)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [business?.id, date])

  const handleWhatsApp = () => {
    if (!summary || !business) return
    const text = buildWhatsAppText(summary, business.name)
    const phone = (business as any).daily_summary_whatsapp ?? ''
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
          <div>
            <h2 className="text-[16px] font-bold text-white">Resumen del día</h2>
            <p className="text-[12px] text-white/50 mt-0.5">
              {date ? new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Hoy'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[13px] text-white/50">Generando resumen...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-red-400 text-[13px]">{error}</p>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">Total ventas</p>
                    <p className="text-[15px] font-bold text-white">{formatCurrency(summary.total_sales)}</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">Transacciones</p>
                    <p className="text-[15px] font-bold text-white">{summary.sales_count}</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">Ganancia est.</p>
                    <p className="text-[15px] font-bold text-emerald-400">{formatCurrency(summary.total_profit)}</p>
                  </div>
                </div>
                {summary.top_product_name && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/40">Más vendido</p>
                      <p className="text-[12px] font-semibold text-white truncate">{summary.top_product_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment breakdown */}
              {Object.keys(summary.payment_breakdown ?? {}).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Métodos de pago</p>
                  {Object.entries(summary.payment_breakdown ?? {}).map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between">
                      <span className="text-[13px] text-white/70 capitalize">{method.replace('_', ' ')}</span>
                      <span className="text-[13px] font-semibold text-white">{formatCurrency(Number(amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => exportSummaryCSV(summary)}
                  className="flex-1 glass-btn flex items-center justify-center gap-1.5 text-[12px] py-2.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 transition text-[12px] font-medium py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

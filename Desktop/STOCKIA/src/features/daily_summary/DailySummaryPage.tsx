import { useEffect, useState } from 'react'
import { CalendarDays, TrendingUp, ShoppingCart, Download, Package, RefreshCw, Loader2 } from 'lucide-react'
import { useBusinessStore } from '@/stores/businessStore'
import { getDailySummaries, generateDailySummary, exportSummaryCSV } from './dailySummaryService'
import { formatCurrency } from '@/lib/utils'
import type { DailySummary } from '@/types/database'
import DailySummaryModal from './DailySummaryModal'
import { toast } from 'sonner'

export default function DailySummaryPage() {
  const { business } = useBusinessStore()
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function loadSummaries() {
    if (!business?.id) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const data = await getDailySummaries(business.id)
      setSummaries(data)
    } catch (e: any) {
      console.error('Error loading daily summaries:', e)
      setError(e?.message || 'Error al cargar resúmenes')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateToday() {
    if (!business?.id) return
    setGenerating(true)
    try {
      await generateDailySummary(business.id)
      await loadSummaries()
      toast.success('Resumen de hoy generado')
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar resumen')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadSummaries()
  }, [business?.id])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Resúmenes diarios</h1>
            <p className="text-[12px] text-white/50">Historial de cierres de caja</p>
          </div>
        </div>
        <button
          onClick={handleGenerateToday}
          disabled={generating || !business?.id}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[13px] font-medium transition disabled:opacity-40"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Generar resumen de hoy
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 flex items-center px-4 gap-4 animate-pulse">
                <div className="h-4 w-24 bg-white/10 rounded" />
                <div className="h-4 w-20 bg-white/10 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-12 h-12 text-red-400/30 mx-auto mb-3" />
            <p className="text-red-400 text-[14px]">{error}</p>
            <button
              onClick={loadSummaries}
              className="mt-3 text-[12px] text-indigo-400 hover:text-indigo-300 transition underline"
            >
              Reintentar
            </button>
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-12 h-12 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-[14px]">No hay resúmenes aún</p>
            <p className="text-white/25 text-[12px] mt-1">Se generan al cerrar la caja o con el botón "Generar resumen de hoy"</p>
            <button
              onClick={handleGenerateToday}
              disabled={generating || !business?.id}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[13px] font-medium transition disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generar resumen de hoy
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-left text-[11px] text-white/30 font-medium uppercase tracking-wide">Fecha</th>
                  <th className="py-3 px-4 text-right text-[11px] text-white/30 font-medium uppercase tracking-wide">Ventas</th>
                  <th className="py-3 px-4 text-right text-[11px] text-white/30 font-medium uppercase tracking-wide hidden sm:table-cell">Transacc.</th>
                  <th className="py-3 px-4 text-right text-[11px] text-white/30 font-medium uppercase tracking-wide">Ganancia</th>
                  <th className="py-3 px-4 text-left text-[11px] text-white/30 font-medium uppercase tracking-wide hidden md:table-cell">Top producto</th>
                  <th className="py-3 px-4 text-right text-[11px] text-white/30 font-medium uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(s => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 hover:bg-white/3 transition cursor-pointer"
                    onClick={() => setSelected(s.date)}
                  >
                    <td className="py-3 px-4 text-[13px] text-white font-medium">
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-right text-[13px] font-semibold text-white">{formatCurrency(s.total_sales)}</td>
                    <td className="py-3 px-4 text-right text-[13px] text-white/70 hidden sm:table-cell">{s.sales_count}</td>
                    <td className={`py-3 px-4 text-right text-[13px] font-semibold ${s.total_profit > 0 ? 'text-green-400' : 'text-white/50'}`}>
                      {formatCurrency(s.total_profit)}
                    </td>
                    <td className="py-3 px-4 text-[12px] text-white/50 hidden md:table-cell">{s.top_product_name ?? '—'}</td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => exportSummaryCSV(s)}
                        className="text-white/40 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
                        title="Exportar CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DailySummaryModal date={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

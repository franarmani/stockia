import { useState } from 'react'
import { toast } from 'sonner'
import { FileDown, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { isOnline } from '@/sync/connectivity'
import { downloadMonthlyReport, loadMonthlyReport } from './monthlyReport'

/** Últimos 12 meses; arranca en el mes anterior durante los primeros días del mes. */
function monthOptions() {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { value: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) }
  })
}

export default function MonthlyReportButton() {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const options = monthOptions()
  const [value, setValue] = useState(new Date().getDate() <= 5 ? options[1].value : options[0].value)
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!profile?.business_id || !business) return
    if (!isOnline()) { toast.error('El reporte necesita conexión a internet'); return }
    const [year, month] = value.split('-').map(Number)
    setBusy(true)
    try {
      const data = await loadMonthlyReport(profile.business_id, business.name, year, month)
      await downloadMonthlyReport(data)
      toast.success('Reporte descargado')
    } catch (error: any) {
      toast.error(`No se pudo generar el reporte: ${error?.message ?? 'error'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select value={value} onChange={e => setValue(e.target.value)} disabled={busy}
        className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs font-semibold capitalize text-white/80 focus:outline-none">
        {options.map(option => <option key={option.value} value={option.value} className="bg-[#10141c] capitalize">{option.label}</option>)}
      </select>
      <button onClick={download} disabled={busy}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#6178ee] px-3.5 text-xs font-semibold text-white hover:bg-[#6f8cff] disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        <span>Reporte PDF</span>
      </button>
    </div>
  )
}

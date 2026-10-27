import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRightLeft, Building2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { isOnline } from '@/sync/connectivity'
import { getPendingOperations } from '@/sync/storage'
import { clearCachedProfileAndBusiness } from '@/lib/sessionCache'

interface LocalSummary {
  id: string
  name: string
  city: string | null
  is_current: boolean
  subscription_status: string
  sales_today: number
  sales_today_count: number
  sales_month: number
  low_stock: number
  cash_open: boolean
}

/** Varios locales (VIP): los números de cada local vinculado y el cambio de local. */
export default function LocalesPage() {
  const [locales, setLocales] = useState<LocalSummary[] | null>(null)
  const [error, setError] = useState('')
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    if (!isOnline()) { setError('Los números de los otros locales se ven con internet.'); return }
    ;(supabase as any).rpc('linked_business_summaries').then(({ data, error: rpcError }: any) => {
      if (rpcError) setError(rpcError.message)
      else setLocales(data ?? [])
    })
  }, [])

  async function switchTo(local: LocalSummary) {
    if (!isOnline()) { toast.error('Para cambiar de local hace falta internet'); return }
    if ((await getPendingOperations()).length > 0) {
      toast.error('Hay cambios de este local sin sincronizar. Esperá a que se envíen y probá de nuevo.')
      return
    }
    if (!confirm(`¿Pasar a "${local.name}"? El programa se recarga con los datos de ese local.`)) return
    setSwitching(local.id)
    const { error: rpcError } = await (supabase as any).rpc('switch_business', { p_business_id: local.id })
    if (rpcError) { setSwitching(null); toast.error(rpcError.message); return }
    clearCachedProfileAndBusiness()
    window.location.assign('/menu')
  }

  const totalToday = locales?.reduce((s, l) => s + Number(l.sales_today), 0) ?? 0
  const totalMonth = locales?.reduce((s, l) => s + Number(l.sales_month), 0) ?? 0

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Mis locales</h1>
          <p className="text-sm text-white/40">Cómo viene cada local hoy y en el mes. Podés pasar a otro sin cerrar sesión.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-8 text-center text-sm text-white/50">{error}</div>
      ) : !locales ? (
        <div className="h-48 grid place-items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : locales.length <= 1 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <Building2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold">Todavía no tenés otros locales vinculados</p>
          <p className="text-sm text-white/40 mt-1">Escribinos a soporte y vinculamos tus locales para que se paguen juntos y los veas desde acá.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-4">
              <p className="text-xs text-white/45">Ventas de hoy, todos los locales</p>
              <p className="mt-1 text-xl font-bold text-white tabular-nums">{formatCurrency(totalToday)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-4">
              <p className="text-xs text-white/45">Ventas del mes, todos los locales</p>
              <p className="mt-1 text-xl font-bold text-white tabular-nums">{formatCurrency(totalMonth)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {locales.map((local) => (
              <div key={local.id} className={cn('rounded-2xl border bg-[#0d1b2d] p-5 space-y-4', local.is_current ? 'border-primary/40' : 'border-white/8')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{local.name}</p>
                    <p className="text-xs text-white/40">{local.city || 'Sin localidad'}</p>
                  </div>
                  {local.is_current
                    ? <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Estás acá</span>
                    : (
                      <button onClick={() => switchTo(local)} disabled={!!switching}
                        className="h-8 px-3 rounded-lg bg-white/5 text-white/80 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50">
                        <ArrowRightLeft className="w-3.5 h-3.5" /> {switching === local.id ? 'Cambiando...' : 'Pasar a este local'}
                      </button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-white/40">Hoy</p>
                    <p className="font-semibold text-white tabular-nums">{formatCurrency(Number(local.sales_today))}</p>
                    <p className="text-[11px] text-white/35">{local.sales_today_count} ventas</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">En el mes</p>
                    <p className="font-semibold text-white tabular-nums">{formatCurrency(Number(local.sales_month))}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5', local.cash_open ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/45')}>
                    <Wallet className="w-3 h-3" /> {local.cash_open ? 'Caja abierta' : 'Caja cerrada'}
                  </span>
                  {local.low_stock > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-300">
                      <AlertTriangle className="w-3 h-3" /> {local.low_stock} productos con poco stock
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

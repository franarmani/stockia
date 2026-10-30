import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRightLeft, Building2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { isOnline } from '@/sync/connectivity'
import { getPendingOperations } from '@/sync/storage'
import { clearCachedProfileAndBusiness } from '@/lib/sessionCache'
import Button from '@/components/ui/Button'

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
          <p className="text-sm text-muted-foreground">Cómo viene cada local hoy y en el mes. Podés pasar a otro sin cerrar sesión.</p>
        </div>
      </div>

      {error ? (
        <div className="cg-card p-8 text-center text-sm text-muted-foreground">{error}</div>
      ) : !locales ? (
        <div className="h-48 grid place-items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : locales.length <= 1 ? (
        <div className="cg-card p-10 text-center border-dashed">
          <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-semibold">Todavía no tenés otros locales vinculados</p>
          <p className="text-sm text-muted-foreground mt-1">Escribinos a soporte y vinculamos tus locales para que se paguen juntos y los veas desde acá.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="cg-card p-4 sm:p-5">
              <p className="text-xs text-muted-foreground font-medium">Ventas de hoy, todos los locales</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{formatCurrency(totalToday)}</p>
            </div>
            <div className="cg-card p-4 sm:p-5">
              <p className="text-xs text-muted-foreground font-medium">Ventas del mes, todos los locales</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{formatCurrency(totalMonth)}</p>
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {locales.map((local) => (
              <div key={local.id} className={cn('cg-card p-5 space-y-4 transition-all', local.is_current ? 'border-primary/50 shadow-sm shadow-primary/10' : '')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate text-base">{local.name}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">{local.city || 'Sin localidad'}</p>
                  </div>
                  {local.is_current
                    ? <span className="rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs font-bold text-primary shrink-0">Estás acá</span>
                    : (
                      <Button variant="secondary" size="sm" onClick={() => switchTo(local)} disabled={!!switching}
                        className="flex items-center gap-1.5 shrink-0 text-xs">
                        <ArrowRightLeft className="w-3.5 h-3.5" /> {switching === local.id ? 'Cambiando...' : 'Pasar a este local'}
                      </Button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-1 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Hoy</p>
                    <p className="font-bold text-foreground tabular-nums text-base">{formatCurrency(Number(local.sales_today))}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{local.sales_today_count} ventas</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">En el mes</p>
                    <p className="font-bold text-foreground tabular-nums text-base">{formatCurrency(Number(local.sales_month))}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border',
                    local.cash_open ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-surface-secondary border-border text-muted-foreground')}>
                    <Wallet className="w-3.5 h-3.5" /> {local.cash_open ? 'Caja abierta' : 'Caja cerrada'}
                  </span>
                  {local.low_stock > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" /> {local.low_stock} productos con poco stock
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

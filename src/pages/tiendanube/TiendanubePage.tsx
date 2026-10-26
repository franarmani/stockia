import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Link2, Loader2, RefreshCw, Search, ShoppingBag, Unplug } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { getLocalProducts } from '@/sync/storage'
import { isOnline } from '@/sync/connectivity'
import { openExternal } from '@/desktop/openExternal'
import { formatCurrency } from '@/lib/utils'
import { tiendanube, type TiendanubeStatus, type UnmatchedVariant } from '@/features/tiendanube/tiendanubeService'

type LocalOption = { id: string; name: string; barcode: string | null }

const card = 'rounded-2xl border border-white/8 bg-[#0d1b2d] p-5'
const button = 'h-9 px-4 rounded-lg text-[13px] font-semibold disabled:opacity-50 flex items-center gap-1.5'

/** Elegir a mano el producto de CajaGo para una variante de Tiendanube sin código coincidente. */
function ProductLinker({ variant, options, onLinked }: { variant: UnmatchedVariant; options: LocalOption[]; onLinked: () => void }) {
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (q.length < 2) return []
    return options.filter(o => o.name.toLowerCase().includes(q) || o.barcode?.toLowerCase().includes(q)).slice(0, 6)
  }, [term, options])

  async function link(option: LocalOption) {
    setBusy(true)
    try {
      await tiendanube.link(variant, option.id)
      toast.success(`${variant.name} quedó vinculado a ${option.name}`)
      onLinked()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2 border-t border-white/[0.06] py-3 sm:grid-cols-[1fr_1fr] sm:items-start">
      <div className="min-w-0">
        <p className="truncate text-sm text-white/85">{variant.name}</p>
        <p className="text-[12px] text-white/35">{variant.sku ? `SKU ${variant.sku}` : 'Sin SKU'}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
        <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Buscar el producto en CajaGo" disabled={busy}
          className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-primary/40" />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#10141c] shadow-xl">
            {matches.map(option => (
              <button key={option.id} onClick={() => link(option)} disabled={busy}
                className="block w-full truncate px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/[0.06]">
                {option.name}{option.barcode ? <span className="text-white/35"> · {option.barcode}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TiendanubePage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [status, setStatus] = useState<TiendanubeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [unmatched, setUnmatched] = useState<{ list: UnmatchedVariant[]; total: number } | null>(null)
  const [options, setOptions] = useState<LocalOption[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function refresh() {
    if (!isOnline()) { setLoading(false); return }
    try {
      setStatus(await tiendanube.status())
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    if (profile?.business_id) getLocalProducts(profile.business_id).then(rows => setOptions(rows.map(p => ({ id: p.id, name: p.name, barcode: p.barcode ?? null }))))
  }, [profile?.business_id])

  // Después de abrir Tiendanube, se consulta un rato hasta que la conexión aparezca.
  useEffect(() => {
    if (status?.connected && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [status?.connected])

  async function connect() {
    setBusy('connect')
    try {
      const { url } = await tiendanube.connectUrl()
      await openExternal(url)
      if (pollRef.current) clearInterval(pollRef.current)
      let tries = 0
      pollRef.current = setInterval(() => { if (++tries > 40) { clearInterval(pollRef.current!); pollRef.current = null } refresh() }, 5000)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  async function sync() {
    setBusy('sync')
    try {
      const result = await tiendanube.sync()
      setUnmatched({ list: result.unmatched, total: result.unmatched_total })
      toast.success(`${result.linked} de ${result.variants} productos de Tiendanube vinculados. El stock se empieza a mandar en el próximo minuto.`)
      refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Tiendanube? Dejan de llegar las ventas y de actualizarse el stock.')) return
    setBusy('disconnect')
    try {
      await tiendanube.disconnect()
      setUnmatched(null)
      toast.success('Tiendanube desconectada')
      refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="animate-fade-in mx-auto w-full max-w-5xl space-y-6 pb-10">
      <div>
        <h1 className="cg-title">Tiendanube</h1>
        <p className="mt-1 text-sm text-white/45">Las ventas pagadas de tu Tiendanube entran solas a CajaGo y el stock de CajaGo se actualiza en tu tienda.</p>
      </div>

      {loading ? (
        <div className={card}><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : !isOnline() ? (
        <div className={card}><p className="text-sm text-white/50">Tiendanube necesita conexión a internet.</p></div>
      ) : !status?.connected ? (
        <div className={`${card} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#6178ee]/15 text-[#9aa9ff]"><ShoppingBag className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-white">Conectá tu tienda</p>
              <p className="text-[13px] text-white/45">Se abre Tiendanube, aceptás los permisos y listo. No hace falta copiar claves.</p>
            </div>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-white/60">
            <li>Tocá "Conectar mi Tiendanube" y aceptá en la ventana que se abre.</li>
            <li>Volvé acá: la conexión aparece sola en unos segundos.</li>
            <li>Tocá "Sincronizar productos". Se vinculan por código: el SKU de Tiendanube tiene que ser igual al código del producto en CajaGo.</li>
          </ol>
          {isAdmin ? (
            <button onClick={connect} disabled={busy !== null} className={`${button} bg-[#6178ee] text-white hover:bg-[#6f8cff]`}>
              {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Conectar mi Tiendanube
            </button>
          ) : (
            <p className="text-[13px] text-white/40">Pedile a un administrador que conecte la tienda.</p>
          )}
          {pollRef.current && <p className="text-[12px] text-white/35">Esperando la autorización de Tiendanube…</p>}
        </div>
      ) : (
        <>
          <div className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-white">{status.store_name ?? 'Tu tienda'} está conectada</p>
                  <p className="text-[12px] text-white/40">Desde el {new Date(status.connected_at!).toLocaleDateString('es-AR')}{status.last_sync_at ? ` · última actualización ${new Date(status.last_sync_at).toLocaleString('es-AR')}` : ''}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={sync} disabled={busy !== null} className={`${button} bg-[#6178ee] text-white hover:bg-[#6f8cff]`}>
                    {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar productos
                  </button>
                  <button onClick={disconnect} disabled={busy !== null} className={`${button} text-red-300/80 hover:bg-red-500/10`}>
                    <Unplug className="h-4 w-4" /> Desconectar
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[12px] text-white/40">Productos vinculados</p><p className="text-xl font-semibold text-white tabular-nums">{status.linked}</p></div>
              <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[12px] text-white/40">Stock por mandar</p><p className="text-xl font-semibold text-white tabular-nums">{status.pending_stock}</p></div>
              <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[12px] text-white/40">Ventas recibidas</p><p className="text-xl font-semibold text-white tabular-nums">{status.orders.length}</p></div>
            </div>
            {status.last_error && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200/90">Último aviso: {status.last_error}</p>}
          </div>

          {unmatched && unmatched.total > 0 && (
            <div className={card}>
              <p className="font-semibold text-white">Productos de Tiendanube sin vincular ({unmatched.total})</p>
              <p className="mb-2 text-[13px] text-white/45">Su SKU no coincide con ningún código de CajaGo. Elegí a cuál corresponde cada uno (o cargá el mismo código en los dos lados y volvé a sincronizar).</p>
              {unmatched.list.map(variant => (
                <ProductLinker key={variant.tn_variant_id} variant={variant} options={options}
                  onLinked={() => setUnmatched(prev => prev && { list: prev.list.filter(v => v.tn_variant_id !== variant.tn_variant_id), total: prev.total - 1 })} />
              ))}
            </div>
          )}

          <div className={card}>
            <p className="mb-3 font-semibold text-white">Últimas ventas de Tiendanube</p>
            {status.orders.length === 0 ? (
              <p className="text-sm text-white/40">Todavía no llegó ninguna venta pagada.</p>
            ) : status.orders.map(order => {
              const unlinked = order.items.filter(item => !item.product_id).length
              return (
                <div key={order.tn_order_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] py-2.5 first:border-t-0">
                  <span className="text-sm font-medium text-white">#{order.order_number ?? order.tn_order_id}</span>
                  <span className="text-[13px] text-white/50">{order.customer_name ?? 'Cliente'} · {new Date(order.created_at).toLocaleString('es-AR')}</span>
                  {unlinked > 0 && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">{unlinked} sin vincular (no descontó stock)</span>}
                  <span className="ml-auto text-sm font-semibold text-white tabular-nums">{formatCurrency(Number(order.total))}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Minus, Plus, Search, ShoppingBag, X, MapPin, CheckCircle2, MessageCircle, Loader2, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface StoreInfo {
  name: string
  logo_url: string | null
  address: string | null
  message: string | null
  has_whatsapp: boolean
  cover_url?: string | null
  color?: string | null
}
interface StoreProduct { id: string; name: string; price: number; unit: string | null; image_url: string | null; category_id: string | null; brand: string | null; in_stock: boolean }
interface StoreCategory { id: string; name: string }

const PAGE_SIZE = 48
const cartKey = (slug: string) => `cajago_store_cart:${slug}`

function loadCart(slug: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(cartKey(slug)) || '{}') } catch { return {} }
}

/** Color del negocio con transparencia, para fondos suaves. */
function tint(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function initials(name: string) {
  return name.split(/\s+/).filter(word => /[a-záéíóúñ0-9]/i.test(word)).slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

// Tienda online pública de un negocio: catálogo, carrito y pedido por WhatsApp.
export default function StorefrontPage() {
  const { slug = '' } = useParams()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [cart, setCart] = useState<Record<string, number>>(() => loadCart(slug))
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState({ name: '', phone: '', notes: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ order_number: number; total: number; whatsapp_url: string | null } | null>(null)

  useEffect(() => {
    supabase.functions.invoke('online-store', { body: { action: 'catalog', slug } }).then(({ data, error }) => {
      if (error || !data?.store) { setStatus('missing'); return }
      setStore(data.store)
      setProducts(data.products)
      setCategories(data.categories)
      setStatus('ready')
      document.title = `${data.store.name} · Tienda online`
    })
  }, [slug])

  useEffect(() => {
    try { localStorage.setItem(cartKey(slug), JSON.stringify(cart)) } catch {}
  }, [cart, slug])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter(p =>
      (!category || p.category_id === category) &&
      (!term || p.name.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term)))
  }, [products, search, category])

  const usedCategories = useMemo(() => categories.filter(c => products.some(p => p.category_id === c.id)), [categories, products])
  const cartLines = useMemo(() => products.filter(p => cart[p.id] > 0).map(p => ({ product: p, quantity: cart[p.id] })), [products, cart])
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const cartTotal = cartLines.reduce((sum, line) => sum + line.quantity * line.product.price, 0)
  const accent = store?.color && /^#[0-9a-f]{6}$/i.test(store.color) ? store.color : '#0f172a'

  function setQuantity(productId: string, quantity: number) {
    setCart(prev => {
      const next = { ...prev }
      if (quantity <= 0) delete next[productId]
      else next[productId] = Math.min(999, quantity)
      return next
    })
  }

  async function sendOrder(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSending(true)
    const { data, error: invokeError } = await supabase.functions.invoke('online-store', {
      body: {
        action: 'order',
        slug,
        customer_name: checkout.name,
        customer_phone: checkout.phone,
        notes: checkout.notes,
        items: cartLines.map(line => ({ product_id: line.product.id, quantity: line.quantity })),
      },
    })
    setSending(false)
    if (invokeError || !data?.order_number) {
      const detail = await (invokeError as any)?.context?.json?.().catch(() => null)
      setError(detail?.error || 'No pudimos enviar el pedido. Probá de nuevo.')
      return
    }
    setDone(data)
    setCart({})
    if (data.whatsapp_url) window.open(data.whatsapp_url, '_blank', 'noopener')
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#f5f6f8] grid place-items-center"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
  }

  if (status === 'missing' || !store) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] grid place-items-center px-6 text-center">
        <div>
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Esta tienda no está disponible</h1>
          <p className="mt-1 text-sm text-slate-500">Revisá el link o consultá al comercio.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900 pb-28">
      {/* Portada y datos del comercio */}
      <header className="bg-white">
        <div
          className="h-32 sm:h-48 w-full bg-cover bg-center"
          style={store.cover_url
            ? { backgroundImage: `url(${store.cover_url})` }
            : { background: `linear-gradient(120deg, ${accent}, ${tint(accent, 0.75)})` }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="-mt-10 sm:-mt-12 h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 grid place-items-center overflow-hidden">
              {store.logo_url
                ? <img src={store.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                : <span className="text-2xl font-bold" style={{ color: accent }}>{initials(store.name)}</span>}
            </div>
            <div className="min-w-0 pt-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{store.name}</h1>
              {store.address && (
                <p className="mt-1 flex items-center gap-1 text-[13px] text-slate-500 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />{store.address}
                </p>
              )}
            </div>
          </div>
          {store.message && (
            <p className="mt-4 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-700" style={{ background: tint(accent, 0.07) }}>{store.message}</p>
          )}
        </div>
      </header>

      {/* Buscador y categorías */}
      <div className="sticky top-0 z-20 border-y border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE) }} placeholder={`Buscar entre ${products.length} productos`}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm focus:bg-white focus:outline-none focus:border-slate-400" />
          </div>
          {usedCategories.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {[{ id: '', name: 'Todo' }, ...usedCategories].map(c => {
                const active = category === c.id
                return (
                  <button key={c.id || 'all'} onClick={() => { setCategory(c.id); setLimit(PAGE_SIZE) }}
                    className="h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors"
                    style={active ? { background: accent, borderColor: accent, color: '#fff' } : { background: '#fff', borderColor: '#e2e8f0', color: '#475569' }}>
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <p className="mb-3 text-[13px] text-slate-500">{visible.length} {visible.length === 1 ? 'producto' : 'productos'}</p>
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No encontramos productos con esa búsqueda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {visible.slice(0, limit).map(product => {
              const quantity = cart[product.id] ?? 0
              return (
                <article key={product.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-shadow hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                  <div className="relative aspect-square overflow-hidden" style={{ background: tint(accent, 0.05) }}>
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      : <Package className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2" strokeWidth={1.25} style={{ color: tint(accent, 0.3) }} />}
                    {!product.in_stock && (
                      <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-medium text-amber-700 shadow-sm">Consultar stock</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    {product.brand && <p className="truncate text-[11px] text-slate-400">{product.brand}</p>}
                    <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-5 text-slate-800">{product.name}</p>
                    <p className="mt-1.5 text-[17px] font-bold tabular-nums">
                      {formatCurrency(product.price)}
                      {product.unit && product.unit !== 'u' && <span className="text-xs font-normal text-slate-500"> / {product.unit}</span>}
                    </p>
                    <div className="mt-auto pt-3">
                      {quantity === 0 ? (
                        <button onClick={() => setQuantity(product.id, 1)}
                          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition-colors active:scale-[0.98]"
                          style={{ borderColor: tint(accent, 0.3), color: accent }}>
                          <Plus className="h-4 w-4" /> Agregar
                        </button>
                      ) : (
                        <div className="flex h-9 items-center justify-between rounded-xl text-white" style={{ background: accent }}>
                          <button onClick={() => setQuantity(product.id, quantity - 1)} className="grid h-9 w-9 place-items-center" aria-label="Quitar uno"><Minus className="h-4 w-4" /></button>
                          <span className="text-sm font-semibold tabular-nums">{quantity}</span>
                          <button onClick={() => setQuantity(product.id, quantity + 1)} className="grid h-9 w-9 place-items-center" aria-label="Agregar uno"><Plus className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        {visible.length > limit && (
          <button onClick={() => setLimit(limit + PAGE_SIZE)}
            className="mx-auto mt-6 block h-11 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ver más productos
          </button>
        )}
        <p className="mt-10 text-center text-[12px] text-slate-400">Tienda creada con CajaGo</p>
      </main>

      {cartCount > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <button onClick={() => setCartOpen(true)}
            className="mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-2xl px-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.25)]"
            style={{ background: accent }}>
            <span className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-5 w-5" /> Ver pedido ({cartCount})</span>
            <span className="text-base font-bold tabular-nums">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {(cartOpen || done) && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !sending && (setCartOpen(false), setDone(null))}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl" onClick={e => e.stopPropagation()}>
            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
                <h2 className="mt-4 text-xl font-bold">¡Pedido #{done.order_number} enviado!</h2>
                <p className="mt-2 text-sm text-slate-500">Total {formatCurrency(done.total)}. {store.name} lo recibe y te contacta para coordinar.</p>
                {done.whatsapp_url && (
                  <a href={done.whatsapp_url} target="_blank" rel="noopener" className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-[#25d366] px-6 font-semibold text-white">
                    <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp
                  </a>
                )}
                <button onClick={() => { setDone(null); setCartOpen(false) }} className="mx-auto mt-3 block text-sm text-slate-500 underline">Seguir mirando</button>
              </div>
            ) : (
              <form onSubmit={sendOrder} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Tu pedido</h2>
                  <button type="button" onClick={() => setCartOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100" aria-label="Cerrar"><X className="h-4 w-4" /></button>
                </div>
                <div className="divide-y divide-slate-100">
                  {cartLines.map(line => (
                    <div key={line.product.id} className="flex items-center gap-3 py-2.5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: tint(accent, 0.06) }}>
                        {line.product.image_url
                          ? <img src={line.product.image_url} alt="" className="h-full w-full object-cover" />
                          : <Package className="h-4 w-4" strokeWidth={1.5} style={{ color: tint(accent, 0.4) }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{line.product.name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(line.product.price)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200">
                        <button type="button" onClick={() => setQuantity(line.product.id, line.quantity - 1)} className="grid h-8 w-8 place-items-center" aria-label="Quitar uno"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                        <button type="button" onClick={() => setQuantity(line.product.id, line.quantity + 1)} className="grid h-8 w-8 place-items-center" aria-label="Agregar uno"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
                  <span>Total</span><span className="tabular-nums">{formatCurrency(cartTotal)}</span>
                </div>
                <input required value={checkout.name} onChange={e => setCheckout({ ...checkout, name: e.target.value })} placeholder="Tu nombre" maxLength={80}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none" />
                <input required value={checkout.phone} onChange={e => setCheckout({ ...checkout, phone: e.target.value })} placeholder="Tu teléfono" inputMode="tel" maxLength={30}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none" />
                <textarea value={checkout.notes} onChange={e => setCheckout({ ...checkout, notes: e.target.value })} placeholder="Notas: retiro en el local, envío a domicilio, horario…" maxLength={500} rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={sending || cartLines.length === 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: accent }}>
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {store.has_whatsapp ? 'Enviar pedido por WhatsApp' : 'Enviar pedido'}
                </button>
                <p className="text-center text-[11px] text-slate-400">El comercio confirma precio, stock y forma de entrega.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

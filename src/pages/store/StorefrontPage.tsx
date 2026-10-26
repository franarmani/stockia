import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Minus, Plus, Search, ShoppingBag, X, MapPin, CheckCircle2, MessageCircle, Loader2, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface StoreInfo { name: string; logo_url: string | null; address: string | null; message: string | null; has_whatsapp: boolean }
interface StoreProduct { id: string; name: string; price: number; unit: string | null; image_url: string | null; category_id: string | null; brand: string | null; in_stock: boolean }
interface StoreCategory { id: string; name: string }

const cartKey = (slug: string) => `cajago_store_cart:${slug}`

function loadCart(slug: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(cartKey(slug)) || '{}') } catch { return {} }
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
    return <div className="min-h-screen bg-[#f6f7f9] grid place-items-center"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
  }

  if (status === 'missing' || !store) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] grid place-items-center px-6 text-center">
        <div>
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Esta tienda no está disponible</h1>
          <p className="mt-1 text-sm text-slate-500">Revisá el link o consultá al comercio.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 pb-28">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-4">
          {store.logo_url ? (
            <img src={store.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white grid place-items-center text-xl font-bold">{store.name.charAt(0)}</div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight truncate">{store.name}</h1>
            {store.address && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{store.address}</p>}
          </div>
        </div>
        {store.message && <p className="max-w-5xl mx-auto px-4 pb-4 text-sm text-slate-600">{store.message}</p>}
      </header>

      <div className="sticky top-0 z-20 bg-[#f6f7f9]/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400" />
          </div>
          {usedCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {[{ id: '', name: 'Todo' }, ...usedCategories].map(c => (
                <button key={c.id || 'all'} onClick={() => setCategory(c.id)}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border ${category === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-16">No encontramos productos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map(product => {
              const quantity = cart[product.id] ?? 0
              return (
                <article key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="aspect-square bg-slate-100 grid place-items-center">
                    {product.image_url
                      ? <img src={product.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <Package className="w-8 h-8 text-slate-300" />}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-sm font-semibold leading-snug line-clamp-2">{product.name}</p>
                    <p className="mt-1 text-base font-extrabold">{formatCurrency(product.price)}{product.unit && product.unit !== 'u' ? <span className="text-xs font-medium text-slate-500"> / {product.unit}</span> : null}</p>
                    {!product.in_stock && <p className="text-[11px] text-amber-600 font-semibold">Consultar disponibilidad</p>}
                    <div className="mt-auto pt-3">
                      {quantity === 0 ? (
                        <button onClick={() => setQuantity(product.id, 1)} className="w-full h-9 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98]">Agregar</button>
                      ) : (
                        <div className="flex items-center justify-between h-9 rounded-xl border border-slate-200">
                          <button onClick={() => setQuantity(product.id, quantity - 1)} className="w-9 h-9 grid place-items-center" aria-label="Quitar uno"><Minus className="w-4 h-4" /></button>
                          <span className="text-sm font-bold tabular-nums">{quantity}</span>
                          <button onClick={() => setQuantity(product.id, quantity + 1)} className="w-9 h-9 grid place-items-center" aria-label="Agregar uno"><Plus className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#f6f7f9] via-[#f6f7f9]">
          <button onClick={() => setCartOpen(true)} className="max-w-5xl mx-auto w-full h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-between px-5 shadow-xl">
            <span className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="w-5 h-5" /> Ver pedido ({cartCount})</span>
            <span className="text-base font-extrabold tabular-nums">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {(cartOpen || done) && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !sending && (setCartOpen(false), setDone(null))}>
          <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            {done ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                <h2 className="mt-4 text-xl font-extrabold">¡Pedido #{done.order_number} enviado!</h2>
                <p className="mt-2 text-sm text-slate-500">Total {formatCurrency(done.total)}. {store.name} lo recibe y te contacta para coordinar.</p>
                {done.whatsapp_url && (
                  <a href={done.whatsapp_url} target="_blank" rel="noopener" className="mt-5 inline-flex h-12 items-center gap-2 px-6 rounded-xl bg-[#25d366] text-white font-bold">
                    <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
                  </a>
                )}
                <button onClick={() => { setDone(null); setCartOpen(false) }} className="mt-3 block mx-auto text-sm text-slate-500 underline">Seguir mirando</button>
              </div>
            ) : (
              <form onSubmit={sendOrder} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">Tu pedido</h2>
                  <button type="button" onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
                <div className="divide-y divide-slate-100">
                  {cartLines.map(line => (
                    <div key={line.product.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{line.product.name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(line.product.price)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200">
                        <button type="button" onClick={() => setQuantity(line.product.id, line.quantity - 1)} className="w-8 h-8 grid place-items-center" aria-label="Quitar uno"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                        <button type="button" onClick={() => setQuantity(line.product.id, line.quantity + 1)} className="w-8 h-8 grid place-items-center" aria-label="Agregar uno"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-base font-extrabold border-t border-slate-200 pt-3">
                  <span>Total</span><span className="tabular-nums">{formatCurrency(cartTotal)}</span>
                </div>
                <input required value={checkout.name} onChange={e => setCheckout({ ...checkout, name: e.target.value })} placeholder="Tu nombre" maxLength={80}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400" />
                <input required value={checkout.phone} onChange={e => setCheckout({ ...checkout, phone: e.target.value })} placeholder="Tu teléfono" inputMode="tel" maxLength={30}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400" />
                <textarea value={checkout.notes} onChange={e => setCheckout({ ...checkout, notes: e.target.value })} placeholder="Notas: retiro en el local, envío a domicilio, horario…" maxLength={500} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400 resize-none" />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={sending || cartLines.length === 0} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {store.has_whatsapp ? 'Enviar pedido por WhatsApp' : 'Enviar pedido'}
                </button>
                <p className="text-[11px] text-center text-slate-400">El comercio confirma precio, stock y forma de entrega.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

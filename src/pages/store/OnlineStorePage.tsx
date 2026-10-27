import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, ExternalLink, Globe, Phone, ShoppingCart, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { usePOSStore } from '@/stores/posStore'
import { getLocalProducts } from '@/sync/storage'
import { cachedQuery } from '@/sync/remote'
import { isOnline } from '@/sync/connectivity'
import { openExternal } from '@/desktop/openExternal'
import { PUBLIC_WEB_URL } from '@/config/publicUrls'
import ImagePicker from '@/features/onlineStore/ImagePicker'
import ProductPhotosSection from '@/features/onlineStore/ProductPhotosSection'
import { removeStoreImage } from '@/features/onlineStore/storeImages'
import { cn, formatCurrency } from '@/lib/utils'
import type { Product } from '@/types/database'

// La tienda pública vive en la web (también para quien usa el programa de escritorio).
const PUBLIC_STORE_BASE = `${PUBLIC_WEB_URL}/tienda/`

interface OnlineOrder {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  notes: string | null
  items: Array<{ product_id: string; name: string; quantity: number; price: number }>
  total: number
  status: 'new' | 'confirmed' | 'delivered' | 'cancelled'
  created_at: string
}

const STATUS_LABELS: Record<OnlineOrder['status'], string> = {
  new: 'Nuevo', confirmed: 'Confirmado', delivered: 'Entregado', cancelled: 'Cancelado',
}
const STATUS_STYLES: Record<OnlineOrder['status'], string> = {
  new: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  confirmed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-white/5 text-white/40 border-white/10',
}

const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

export default function OnlineStorePage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business, fetchBusiness } = useBusinessStore()
  const b = business as any
  const [form, setForm] = useState({ enabled: false, slug: '', whatsapp: '', message: '', cover: null as string | null })
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  useEffect(() => {
    if (!business) return
    setForm({
      enabled: !!b.store_enabled,
      slug: b.store_slug || slugify(business.name),
      whatsapp: b.store_whatsapp || business.phone || '',
      message: b.store_message || '',
      cover: b.store_cover_url || null,
    })
  }, [business?.id])

  async function loadOrders() {
    if (!profile?.business_id) return
    const { data, error } = await cachedQuery(`online_orders:${profile.business_id}`, (supabase as any)
      .from('online_orders').select('*').eq('business_id', profile.business_id)
      .order('created_at', { ascending: false }).limit(200))
    if (!error) setOrders((data as OnlineOrder[]) ?? [])
  }

  useEffect(() => {
    loadOrders()
    const timer = setInterval(loadOrders, 60000)
    return () => clearInterval(timer)
  }, [profile?.business_id])

  const storeUrl = PUBLIC_STORE_BASE + (b?.store_slug || form.slug)

  async function save() {
    if (!business) return
    if (!/^[a-z0-9-]{3,40}$/.test(form.slug)) { toast.error('El link solo puede tener letras minúsculas, números y guiones (3 a 40)'); return }
    if (!isOnline()) { toast.error('Guardar la tienda necesita conexión'); return }
    setSaving(true)
    const { error } = await supabase.from('businesses').update({
      store_enabled: form.enabled,
      store_slug: form.slug,
      store_whatsapp: form.whatsapp.trim() || null,
      store_message: form.message.trim() || null,
      store_cover_url: form.cover,
    } as any).eq('id', business.id)
    setSaving(false)
    if (error) {
      toast.error(error.code === '23505' ? 'Ese link ya lo usa otro negocio. Probá con otro.' : 'No se pudo guardar la tienda')
      return
    }
    if (b.store_cover_url && b.store_cover_url !== form.cover) removeStoreImage(b.store_cover_url).catch(() => {})
    await fetchBusiness(business.id)
    toast.success(form.enabled ? 'Tienda online activa' : 'Tienda guardada (desactivada)')
  }

  async function setStatus(order: OnlineOrder, status: OnlineOrder['status']) {
    if (!isOnline()) { toast.error('Actualizar pedidos necesita conexión'); return }
    const { error } = await (supabase as any).from('online_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', order.id)
    if (error) { toast.error('No se pudo actualizar el pedido'); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o))
  }

  // Carga el pedido en el punto de venta con los precios actuales para cobrarlo.
  async function sendToPOS(order: OnlineOrder) {
    if (!profile?.business_id) return
    const products = await getLocalProducts(profile.business_id)
    const byId = new Map(products.map(p => [p.id, p]))
    const items = order.items.flatMap(line => {
      const product = byId.get(line.product_id)
      return product ? [{ product: product as unknown as Product, quantity: line.quantity, price: Number(product.sale_price) }] : []
    })
    if (items.length === 0) { toast.error('Los productos del pedido ya no existen'); return }
    if (items.length < order.items.length) toast.warning('Algunos productos del pedido ya no existen y no se cargaron')
    usePOSStore.getState().loadCart(items)
    if (order.status === 'new') setStatus(order, 'confirmed')
    navigate('/pos')
  }

  // La tienda web es para quien no tiene tienda propia: con Tiendanube, los pedidos llegan por ahí.
  if (b?.tiendanube_connected) {
    return (
      <div className="animate-fade-in mx-auto w-full max-w-3xl pb-10">
        <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-6">
          <h1 className="cg-title">Tienda online</h1>
          <p className="mt-2 text-sm text-white/55">Tu negocio vende online con <b className="text-white">Tiendanube</b>, así que la tienda web de CajaGo está apagada. Los pedidos pagados de Tiendanube entran solos a CajaGo.</p>
          <button onClick={() => navigate('/tiendanube')} className="mt-4 h-9 rounded-lg bg-[#6178ee] px-4 text-[13px] font-semibold text-white hover:bg-[#6f8cff]">Ir a Tiendanube</button>
        </div>
      </div>
    )
  }

  const visibleOrders = orders.filter(o => filter === 'all' || o.status === 'new' || o.status === 'confirmed')
  const input = 'w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40'

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Tienda online</h1>
          <p className="text-sm text-white/40">Tu catálogo en un link: tus clientes eligen y te mandan el pedido por WhatsApp.</p>
        </div>
      </div>

      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
            Tienda activa
          </label>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Link de tu tienda</label>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <span className="pl-3 text-xs text-white/30 whitespace-nowrap hidden sm:inline">{PUBLIC_STORE_BASE.replace('https://', '')}</span>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} className="flex-1 h-10 px-2 bg-transparent text-white text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">WhatsApp que recibe los pedidos</label>
            <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="Ej: 5492915551234" className={input} />
            <p className="mt-1 text-[11px] text-white/30">Con código de país y de área, sin el 0 ni el 15.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Mensaje para tus clientes (opcional)</label>
            <input value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Envíos en el día · Retiro en el local de 9 a 20 h" maxLength={160} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Portada de la tienda (opcional)</label>
            <ImagePicker kind="cover" label="Portada" value={form.cover} onChange={cover => setForm({ ...form, cover })} />
            <p className="mt-1 text-[11px] text-white/30">Una foto del local o de tus productos. Se ve arriba de todo en la tienda.</p>
          </div>
          <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <p className="text-[11px] text-white/30">Se muestran los productos activos con precio. Para ocultar uno, desmarcá "Mostrar en la tienda online" al editarlo.</p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 flex flex-col items-center text-center gap-3">
          {b?.store_enabled && b?.store_slug ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(storeUrl)}`}
                alt="QR de la tienda"
                className="w-44 h-44 rounded-xl bg-white"
              />
              <p className="text-xs text-white/50 break-all">{storeUrl}</p>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(storeUrl); toast.success('Link copiado') }} className="h-9 px-3 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
                <button onClick={() => openExternal(storeUrl)} className="h-9 px-3 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </button>
              </div>
              <p className="text-[11px] text-white/30">Imprimí el QR para el mostrador o compartí el link en tus redes.</p>
            </>
          ) : (
            <p className="text-sm text-white/40 my-auto">Activá la tienda y guardá para ver tu link y el código QR.</p>
          )}
        </div>
      </section>

      {profile?.business_id && <ProductPhotosSection businessId={profile.business_id} />}

      <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Pedidos</h2>
          <div className="flex items-center gap-2">
            {(['open', 'all'] as const).map(value => (
              <button key={value} onClick={() => setFilter(value)}
                className={cn('h-8 px-3 rounded-lg text-xs font-semibold border', filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60')}>
                {value === 'open' ? 'Pendientes' : 'Todos'}
              </button>
            ))}
            <button onClick={loadOrders} className="w-8 h-8 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 grid place-items-center" aria-label="Actualizar">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {visibleOrders.length === 0 ? (
          <p className="text-sm text-white/40 py-4">No hay pedidos {filter === 'open' ? 'pendientes' : ''}.</p>
        ) : visibleOrders.map(order => (
          <div key={order.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">#{order.order_number} · {order.customer_name}</span>
              <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-bold', STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status]}</span>
              <span className="ml-auto text-sm font-bold text-white">{formatCurrency(Number(order.total))}</span>
            </div>
            <p className="text-xs text-white/40 flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> {order.customer_phone} · {new Date(order.created_at).toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-white/70">{order.items.map(item => `${item.quantity} × ${item.name}`).join(' · ')}</p>
            {order.notes && <p className="text-xs text-amber-200/80">Nota: {order.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {(order.status === 'new' || order.status === 'confirmed') && (
                <button onClick={() => sendToPOS(order)} className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" /> Cobrar en el POS
                </button>
              )}
              {order.status === 'new' && <button onClick={() => setStatus(order, 'confirmed')} className="h-8 px-3 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10">Confirmar</button>}
              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                <button onClick={() => setStatus(order, 'delivered')} className="h-8 px-3 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10">Entregado</button>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <button onClick={() => setStatus(order, 'cancelled')} className="h-8 px-3 rounded-lg text-red-300/70 text-xs font-semibold hover:bg-red-500/10">Cancelar</button>
              )}
              <button onClick={() => openExternal(`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`)} className="h-8 px-3 rounded-lg bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10">WhatsApp al cliente</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { getLocalProducts } from '@/sync/storage'
import { syncEngine } from '@/sync/syncEngine'
import { formatCurrency, cn } from '@/lib/utils'
import ImagePicker from './ImagePicker'
import { removeStoreImage } from './storeImages'

type StoreProduct = { id: string; name: string; sale_price: number; image_url: string | null }

const PAGE = 40

/** Cargar las fotos de muchos productos de la tienda sin abrir uno por uno. */
export default function ProductPhotosSection({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    getLocalProducts(businessId).then(rows => setProducts(rows
      .filter(p => (p as any).show_online !== false && Number(p.sale_price) > 0)
      .map(p => ({ id: p.id, name: p.name, sale_price: Number(p.sale_price), image_url: (p as any).image_url ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name))))
  }, [businessId])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter(p => (!onlyMissing || !p.image_url) && (!term || p.name.toLowerCase().includes(term)))
  }, [products, search, onlyMissing])

  const withPhoto = products.filter(p => p.image_url).length

  async function setPhoto(product: StoreProduct, url: string | null) {
    try {
      await syncEngine.updateRow('products', businessId, product.id, { image_url: url })
      if (product.image_url && product.image_url !== url) removeStoreImage(product.image_url).catch(() => {})
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, image_url: url } : p))
    } catch {
      toast.error('No se pudo guardar la foto del producto')
    }
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Fotos de productos</h2>
          <p className="text-sm text-white/40">{withPhoto} de {products.length} productos de la tienda tienen foto.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE) }} placeholder="Buscar producto"
              className="h-9 w-56 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          {([true, false] as const).map(value => (
            <button key={String(value)} onClick={() => { setOnlyMissing(value); setLimit(PAGE) }}
              className={cn('h-9 px-3 rounded-lg text-xs font-semibold border', onlyMissing === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60')}>
              {value ? 'Sin foto' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">{onlyMissing ? 'Todos los productos de la tienda tienen foto.' : 'No hay productos que coincidan.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visible.slice(0, limit).map(product => (
            <div key={product.id} className="space-y-2">
              <ImagePicker value={product.image_url} onChange={url => setPhoto(product, url)} />
              <div>
                <p className="line-clamp-2 text-[12px] font-medium leading-4 text-white/80">{product.name}</p>
                <p className="text-[12px] text-white/40 tabular-nums">{formatCurrency(product.sale_price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {visible.length > limit && (
        <button onClick={() => setLimit(limit + PAGE)} className="mx-auto block h-9 rounded-lg bg-white/5 px-4 text-xs font-semibold text-white/70 hover:bg-white/10">
          Ver más ({visible.length - limit})
        </button>
      )}
    </section>
  )
}

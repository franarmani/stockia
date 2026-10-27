import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Star } from 'lucide-react'
import { getLocalProducts } from '@/sync/storage'
import { syncEngine } from '@/sync/syncEngine'
import { formatCurrency, cn } from '@/lib/utils'
import ImagePicker from './ImagePicker'
import { removeStoreImage } from './storeImages'

type StoreProduct = { id: string; name: string; sale_price: number; image_url: string | null; featured: boolean }

const PAGE = 40

/** Cargar las fotos de muchos productos de la tienda sin abrir uno por uno. */
export default function ProductPhotosSection({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'missing' | 'featured' | 'all'>('missing')
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    getLocalProducts(businessId).then(rows => setProducts(rows
      .filter(p => (p as any).show_online !== false && Number(p.sale_price) > 0)
      .map(p => ({ id: p.id, name: p.name, sale_price: Number(p.sale_price), image_url: (p as any).image_url ?? null, featured: (p as any).store_featured === true }))
      .sort((a, b) => a.name.localeCompare(b.name))))
  }, [businessId])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter(p =>
      (filter === 'all' || (filter === 'missing' ? !p.image_url : p.featured)) &&
      (!term || p.name.toLowerCase().includes(term)))
  }, [products, search, filter])

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

  async function toggleFeatured(product: StoreProduct) {
    try {
      await syncEngine.updateRow('products', businessId, product.id, { store_featured: !product.featured })
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: !p.featured } : p))
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-[#0d1b2d] p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Fotos y destacados</h2>
          <p className="text-sm text-white/40">{withPhoto} de {products.length} productos tienen foto. Con la estrella, el producto aparece primero en la tienda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE) }} placeholder="Buscar producto"
              className="h-9 w-56 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-primary/40" />
          </div>
          {([['missing', 'Sin foto'], ['featured', 'Destacados'], ['all', 'Todos']] as const).map(([value, label]) => (
            <button key={value} onClick={() => { setFilter(value); setLimit(PAGE) }}
              className={cn('h-9 px-3 rounded-lg text-xs font-semibold border', filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-white/60')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">
          {filter === 'missing' ? 'Todos los productos de la tienda tienen foto.' : filter === 'featured' ? 'Todavía no destacaste productos.' : 'No hay productos que coincidan.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visible.slice(0, limit).map(product => (
            <div key={product.id} className="space-y-2">
              <ImagePicker value={product.image_url} onChange={url => setPhoto(product, url)} searchQuery={product.name} />
              <div className="relative pr-7">
                <button onClick={() => toggleFeatured(product)} aria-label={product.featured ? 'Quitar de destacados' : 'Destacar'}
                  title={product.featured ? 'Quitar de destacados' : 'Destacar en la tienda'}
                  className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-md hover:bg-white/10">
                  <Star className={cn('h-4 w-4', product.featured ? 'fill-amber-400 text-amber-400' : 'text-white/30')} />
                </button>
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

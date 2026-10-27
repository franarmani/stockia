import { useMemo, useState } from 'react'
import { Package } from 'lucide-react'
import Input from '@/components/ui/Input'

export interface PurchaseProductOption {
  id: string
  name: string
  barcode: string | null
  stock: number
  unit: string | null
  purchase_price?: number | null
}

const norm = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Descripción del renglón de compra con sugerencias de productos del catálogo (por nombre o código). */
export default function ProductSearchInput({
  value,
  products,
  onChange,
  onSelect,
}: {
  value: string
  products: PurchaseProductOption[]
  onChange: (text: string) => void
  onSelect: (product: PurchaseProductOption) => void
}) {
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const terms = norm(value).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    return products
      .filter((p) => {
        const haystack = norm(`${p.name} ${p.barcode ?? ''}`)
        return terms.every((term) => haystack.includes(term))
      })
      .slice(0, 8)
  }, [value, products])

  return (
    <div className="relative">
      <Input
        placeholder="Buscá el producto o escribí una descripción"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0E1629] shadow-xl">
          {matches.map((product) => (
            <button
              key={product.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(product); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.06]"
            >
              <Package className="h-3.5 w-3.5 shrink-0 text-[#9CA6BA]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">{product.name}</span>
                <span className="block text-[11px] text-[#9CA6BA]">
                  {product.barcode ? `${product.barcode} · ` : ''}stock {Number(product.stock) || 0}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

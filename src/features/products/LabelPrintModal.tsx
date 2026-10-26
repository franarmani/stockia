import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/stores/businessStore'
import { barcodeFormat, buildLabelsHtml, expandLabels, printHtml, type LabelFormat } from './labels'
import type { Product } from '@/types/database'

export default function LabelPrintModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const business = useBusinessStore((state) => state.business)
  const [format, setFormat] = useState<LabelFormat>('a4')
  const [showPrice, setShowPrice] = useState(true)
  const [showBusiness, setShowBusiness] = useState(false)
  const [copies, setCopies] = useState<Record<string, number>>({})
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (open) setCopies(Object.fromEntries(products.map((p) => [p.id, 1])))
  }, [open, products])

  const withoutCode = products.filter((p) => !barcodeFormat(p.barcode)).length
  const total = products.reduce((sum, p) => sum + (copies[p.id] ?? 0), 0)

  function copiesFromStock() {
    setCopies(Object.fromEntries(products.map((p) => [p.id, Math.max(0, Math.floor(Number(p.stock) || 0))])))
  }

  async function print() {
    if (total === 0) { toast.error('Elegí al menos una etiqueta'); return }
    if (total > 2000 && !confirm(`Vas a imprimir ${total} etiquetas. ¿Seguir?`)) return
    setPrinting(true)
    try {
      const labels = expandLabels(products.map((product) => ({
        product: { id: product.id, name: product.name, sale_price: product.sale_price, barcode: product.barcode },
        copies: copies[product.id] ?? 0,
      })))
      printHtml(await buildLabelsHtml(labels, { format, showPrice, businessName: showBusiness ? business?.name : undefined }))
    } catch (error) {
      console.error('[Labels] failed:', error)
      toast.error('No se pudieron generar las etiquetas')
    } finally {
      setPrinting(false)
    }
  }

  const chip = (selected: boolean) => cn('text-left rounded-xl border p-3', selected ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')

  return (
    <Modal open={open} onClose={onClose} title={`Imprimir etiquetas · ${products.length} producto(s)`} size="lg">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-2">
          <button type="button" className={chip(format === 'a4')} onClick={() => setFormat('a4')}>
            <p className="text-sm font-bold text-white">Hoja A4</p>
            <p className="text-[11px] text-white/40">24 etiquetas por hoja, para recortar o autoadhesivas</p>
          </button>
          <button type="button" className={chip(format === 'thermal')} onClick={() => setFormat('thermal')}>
            <p className="text-sm font-bold text-white">Impresora de etiquetas</p>
            <p className="text-[11px] text-white/40">Rollo de 50 × 25 mm</p>
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-white/70">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Mostrar precio</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showBusiness} onChange={(e) => setShowBusiness(e.target.checked)} /> Nombre del negocio</label>
        </div>

        {withoutCode > 0 && (
          <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
            {withoutCode} producto(s) no tienen código de barras: la etiqueta sale con nombre y precio solamente.
          </p>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-white/60">Cantidad por producto</label>
            <button type="button" onClick={copiesFromStock} className="text-xs text-primary hover:underline">Una por unidad en stock</button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 truncate text-xs text-white/80">{product.name}</span>
                <span className="text-[11px] text-white/30 font-mono">{product.barcode || '—'}</span>
                <input
                  type="number"
                  min={0}
                  value={copies[product.id] ?? 0}
                  onChange={(e) => setCopies({ ...copies, [product.id]: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-16 h-8 px-2 rounded-lg border border-white/10 bg-white/5 text-white text-xs text-center focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10">Cancelar</button>
          <button onClick={print} disabled={printing || total === 0} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
            <Printer className="w-4 h-4" /> {printing ? 'Generando...' : `Imprimir ${total}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

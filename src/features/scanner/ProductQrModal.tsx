import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { openPrintFrame } from '@/lib/documentLayout'
import { saveBlob } from '@/lib/saveFile'
import { toast } from 'sonner'
import { productQrValue } from './scanLookup'

const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * QR de un producto. Lleva solo el link con el id (un código imposible de adivinar): no incluye precios ni
 * datos del negocio, y quien lo escanee desde otro comercio no encuentra nada.
 */
export default function ProductQrModal({
  product,
  businessName,
  onClose,
}: {
  product: { id: string; name: string; code?: string | null; barcode?: string | null } | null
  businessName?: string
  onClose: () => void
}) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!product) { setDataUrl(''); return }
    QRCode.toDataURL(productQrValue(product.id), { width: 640, margin: 2, errorCorrectionLevel: 'M' }).then(setDataUrl).catch(() => setDataUrl(''))
  }, [product])

  if (!product) return null
  const fileBase = `QR_${product.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'producto'}`

  async function download() {
    const blob = await (await fetch(dataUrl)).blob()
    await saveBlob(blob, `${fileBase}.png`).catch(() => toast.error('No se pudo guardar el QR'))
  }

  function print() {
    const w = openPrintFrame()
    w.document.open()
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR ${esc(product!.name)}</title>
      <style>@page{margin:8mm;size:A6}body{font-family:Arial,sans-serif;text-align:center;margin:0;padding:6mm}
      img{width:62mm;height:62mm}h1{font-size:15px;margin:6px 0 2px}p{font-size:11px;color:#444;margin:2px 0}</style></head>
      <body>${businessName ? `<p>${esc(businessName)}</p>` : ''}<img src="${dataUrl}" alt="QR"><h1>${esc(product!.name)}</h1>
      ${product!.code ? `<p>Código ${esc(product!.code)}</p>` : ''}<p>Escanealo con CajaGo</p></body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  return (
    <Modal open onClose={onClose} title="QR del producto" size="sm">
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold text-white">{product.name}</p>
        {dataUrl ? <img src={dataUrl} alt="Código QR del producto" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" /> : <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-white/10" />}
        <p className="text-xs text-white/50">Pegalo en el producto o en el estante. Al escanearlo desde Nueva venta, se agrega solo.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={download} disabled={!dataUrl} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"><Download className="h-4 w-4" /> Descargar</button>
          <button onClick={print} disabled={!dataUrl} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimir</button>
        </div>
      </div>
    </Modal>
  )
}

import { supabase } from '@/lib/supabase'
import type { InvoiceData } from '../../../supabase/functions/_shared/purchaseInvoice'

export type { InvoiceData }

const MAX_SIDE = 1600
const MAX_PAGES = 3

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.85)
}

async function imageToJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvasToJpeg(canvas)
}

/** Las primeras páginas del PDF como imágenes (pdf.js se carga solo cuando hace falta). */
async function pdfToJpegs(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(2, MAX_SIDE / Math.max(base.width, base.height)) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    pages.push(canvasToJpeg(canvas))
  }
  return pages
}

export async function readInvoiceWithAi(file: File): Promise<InvoiceData> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf && !file.type.startsWith('image/')) throw new Error('Subí una foto o un PDF de la factura')
  const images = isPdf ? await pdfToJpegs(file) : [await imageToJpeg(file)]
  const { data, error } = await supabase.functions.invoke('purchase-invoice-ai', { body: { images } })
  if (error) {
    const detail = await (error as any)?.context?.json?.().catch(() => null)
    throw new Error(detail?.error || 'No se pudo leer la factura')
  }
  return data as InvoiceData
}

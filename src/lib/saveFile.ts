import { toast } from 'sonner'
import { checkIsTauriDesktop } from '@/sync/storage'

/**
 * Guarda un archivo que armó el programa (PDF, Excel, CSV).
 * En el programa de escritorio las descargas del navegador no andan: se guarda en Descargas
 * con un comando nativo y se abre con el programa del sistema. En el navegador, descarga normal.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (checkIsTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const path = await invoke<string>('save_download', bytes, { headers: { 'x-file-name': encodeURIComponent(filename) } })
      const saved = path.split(/[\\/]/).pop() ?? filename
      toast.success(`Guardado en Descargas: ${saved}`)
      return
    } catch (error: any) {
      console.error('[saveBlob] no se pudo guardar:', error)
      toast.error(`No se pudo guardar el archivo: ${typeof error === 'string' ? error : error?.message ?? 'error desconocido'}`)
      throw error
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Arma el PDF (A4) de un bloque HTML y lo guarda. El HTML puede ser un documento completo con un .sheet adentro. */
export async function savePdfFromHtml(html: string, filename: string, options: { margin?: number | [number, number, number, number]; width?: number } = {}): Promise<void> {
  // @ts-ignore
  const { default: html2pdf } = await import('html2pdf.js')
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-9999px;top:0;width:${options.width ?? 794}px;background:#fff;color:#000`
  container.innerHTML = html
  document.body.appendChild(container)
  try {
    // Las imágenes (logo) tienen que estar cargadas antes de dibujar.
    await Promise.all(Array.from(container.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve() })))
    const sheet = (container.querySelector('.sheet') as HTMLElement | null) ?? container
    const blob: Blob = await html2pdf().set({
      margin: options.margin ?? 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    } as any).from(sheet).outputPdf('blob')
    await saveBlob(blob, filename)
  } finally {
    container.remove()
  }
}

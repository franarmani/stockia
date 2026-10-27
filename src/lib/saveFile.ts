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

const SCOPE = 'cg-pdf-scope'

/**
 * Los estilos de los documentos traen reglas globales (* { margin: 0 }, body, table...).
 * Metidos tal cual en la pantalla romperían el diseño de la aplicación mientras se arma el PDF,
 * así que se encierran bajo una clase propia.
 */
export function scopeCss(css: string, scope = SCOPE): string {
  const doc = document.implementation.createHTMLDocument('')
  const style = doc.createElement('style')
  style.textContent = css
  doc.head.appendChild(style)
  const prefix = (selector: string) => {
    const sel = selector.trim()
    if (sel === '*') return `.${scope}, .${scope} *`
    if (sel === 'html' || sel === 'body' || sel === 'html body') return `.${scope}`
    return `.${scope} ${sel.replace(/^(html|body)\s+/, '')}`
  }
  const out: string[] = []
  for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
    if (rule instanceof CSSStyleRule) {
      out.push(`${rule.selectorText.split(',').map(prefix).join(', ')} { ${rule.style.cssText} }`)
    } else if (rule instanceof CSSKeyframesRule || rule instanceof CSSFontFaceRule) {
      out.push(rule.cssText)
    }
    // @page y @media print no sirven para armar el PDF: se descartan.
  }
  return out.join(' ')
}

/** Separa los <style> del resto del HTML y los devuelve ya aislados. */
export function isolateHtml(html: string): string {
  const styles: string[] = []
  const body = html
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => { styles.push(css); return '' })
    .replace(/<script[\s\S]*?<\/script>/gi, '')
  return `<style>.${SCOPE}{background:#fff;color:#000} ${scopeCss(styles.join(' '))}</style><div class="${SCOPE}">${body}</div>`
}

/** Arma el PDF (A4) de un bloque HTML y lo guarda. El HTML puede ser un documento completo con un .sheet adentro. */
export async function savePdfFromHtml(html: string, filename: string, options: { margin?: number | [number, number, number, number]; width?: number; avoid?: string } = {}): Promise<void> {
  // @ts-ignore
  const { default: html2pdf } = await import('html2pdf.js')
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-99999px;top:0;width:${options.width ?? 794}px;background:#fff;color:#000;pointer-events:none`
  container.innerHTML = isolateHtml(html)
  document.body.appendChild(container)
  try {
    // Las imágenes (logo) tienen que estar cargadas antes de dibujar.
    await Promise.all(Array.from(container.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve() })))
    const source = container.querySelector(`.${SCOPE}`) as HTMLElement
    const blob: Blob = await html2pdf().set({
      margin: options.margin ?? 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], ...(options.avoid ? { avoid: options.avoid } : {}) },
    } as any).from(source).outputPdf('blob')
    await saveBlob(blob, filename)
  } finally {
    container.remove()
  }
}

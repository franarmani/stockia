// @ts-ignore
import html2pdf from 'html2pdf.js'
import { generateInvoicePDF, type InvoicePDFData } from './invoicePdf'
import { inlineImage, type PrintMode } from './documentLayout'

export interface DownloadPDFOptions {
  filename?: string
  mode?: PrintMode
}

/**
 * Genera el documento HTML completo con el logo procesado
 */
export async function buildInvoiceHtml(data: InvoicePDFData, mode: PrintMode = 'color'): Promise<string> {
  const logoUrl = await inlineImage(data.logoUrl)
  return generateInvoicePDF({ ...data, logoUrl }, mode, false)
}

/**
 * Descarga directamente el archivo PDF al equipo del usuario
 */
export async function downloadInvoicePDF(
  data: InvoicePDFData,
  options: DownloadPDFOptions = {}
): Promise<void> {
  const mode = options.mode || 'color'
  const letter = data.invoiceType?.toUpperCase() || 'C'
  const ptoVta = String(data.puntoVenta || 1).padStart(5, '0')
  const nro = String(data.invoiceNumber || 1).padStart(8, '0')
  const defaultFilename = `Factura_${letter}_${ptoVta}-${nro}.pdf`
  const filename = options.filename || defaultFilename

  // Generar HTML
  const html = await buildInvoiceHtml(data, mode)

  // Crear contenedor temporal fuera de pantalla
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '794px' // A4 width at 96 DPI
  container.style.background = '#ffffff'
  container.style.color = '#000000'
  container.innerHTML = html

  document.body.appendChild(container)

  try {
    const sheetEl = container.querySelector('.sheet') || container

    const opt = {
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
    }

    // @ts-ignore
    await html2pdf().set(opt).from(sheetEl).save()
  } catch (err) {
    console.warn('html2pdf direct render error, falling back to blob download:', err)
    // Fallback: descargar como archivo HTML imprimible
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.replace(/\.pdf$/i, '.html')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  }
}

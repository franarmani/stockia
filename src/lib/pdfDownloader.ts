import { saveBlob, savePdfFromHtml } from './saveFile'
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

  try {
    await savePdfFromHtml(html, filename, { margin: [5, 5, 5, 5] })
  } catch (err) {
    console.warn('html2pdf direct render error, falling back to html download:', err)
    // Respaldo: descargar como archivo HTML imprimible
    await saveBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename.replace(/\.pdf$/i, '.html'))
  }
}

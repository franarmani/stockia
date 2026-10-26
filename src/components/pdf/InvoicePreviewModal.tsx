import React, { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Download, Printer, Palette, Eye, Loader2, Check } from 'lucide-react'
import { buildInvoiceHtml, downloadInvoicePDF } from '@/lib/pdfDownloader'
import type { InvoicePDFData } from '@/lib/invoicePdf'
import type { PrintMode } from '@/lib/documentLayout'
import { toast } from 'sonner'

interface InvoicePreviewModalProps {
  open: boolean
  onClose: () => void
  invoiceData: InvoicePDFData | null
  title?: string
}

export default function InvoicePreviewModal({
  open,
  onClose,
  invoiceData,
  title,
}: InvoicePreviewModalProps) {
  const [mode, setMode] = useState<PrintMode>('color')
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [loadingHtml, setLoadingHtml] = useState<boolean>(false)
  const [downloading, setDownloading] = useState<boolean>(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (open && invoiceData) {
      let isMounted = true
      setLoadingHtml(true)
      buildInvoiceHtml(invoiceData, mode)
        .then((html) => {
          if (isMounted) {
            setHtmlContent(html)
            setLoadingHtml(false)
          }
        })
        .catch((err) => {
          console.error('Error generating invoice HTML:', err)
          if (isMounted) setLoadingHtml(false)
        })
      return () => {
        isMounted = false
      }
    } else {
      setHtmlContent('')
    }
  }, [open, invoiceData, mode])

  if (!invoiceData) return null

  const letter = invoiceData.invoiceType?.toUpperCase() || 'C'
  const ptoVta = String(invoiceData.puntoVenta || 1).padStart(5, '0')
  const nro = String(invoiceData.invoiceNumber || 1).padStart(8, '0')
  const invoiceFullNumber = `${ptoVta}-${nro}`
  const modalTitle = title || `Vista Previa · Factura ${letter} ${invoiceFullNumber}`

  const handlePrint = () => {
    if (!iframeRef.current?.contentWindow) {
      toast.error('No se pudo preparar la impresión')
      return
    }
    try {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    } catch (err) {
      console.error('Print error:', err)
      toast.error('Error al abrir el cuadro de impresión')
    }
  }

  const handleDownload = async () => {
    if (!invoiceData || downloading) return
    setDownloading(true)
    const toastId = toast.loading('Generando archivo PDF...')
    try {
      await downloadInvoicePDF(invoiceData, { mode })
      toast.success('¡PDF descargado con éxito!', { id: toastId })
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Error al generar el PDF para descarga', { id: toastId })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="xl">
      <div className="flex flex-col space-y-4 -mt-1">
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#060B22] p-1 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setMode('color')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                mode === 'color'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Color</span>
            </button>
            <button
              onClick={() => setMode('bw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                mode === 'bw'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>Blanco y Negro</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loadingHtml}
              className="gap-1.5 text-xs font-semibold"
              title="Abrir cuadro de diálogo para imprimir o guardar como PDF"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Imprimir / Guardar</span>
              <span className="sm:hidden">Imprimir</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              disabled={loadingHtml || downloading}
              className="gap-1.5 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-900/30"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Descargando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="relative w-full h-[62vh] min-h-[420px] rounded-xl overflow-hidden border border-white/[0.1] bg-slate-900 shadow-2xl flex items-center justify-center">
          {loadingHtml ? (
            <div className="flex flex-col items-center justify-center gap-3 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-xs font-medium">Cargando vista previa del comprobante...</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title="Vista previa del comprobante"
              srcDoc={htmlContent}
              className="w-full h-full bg-white border-0"
            />
          )}
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between text-xs text-white/40 pt-1">
          <span>Vista oficial en formato A4 según normativa AFIP</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:text-white">
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

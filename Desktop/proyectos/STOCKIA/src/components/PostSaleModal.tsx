import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import TicketPrintModal from '@/components/TicketPrintModal'
import { openInvoicePDF, getWhatsAppLink, type InvoicePDFData } from '@/lib/invoicePdf'
import { formatCurrency } from '@/lib/utils'
import { Printer, FileText, MessageCircle, CheckCircle2, X, Download } from 'lucide-react'
import type { CartItem } from '@/types/database'

export interface PostSaleData {
  // Ticket data (for thermal print)
  businessName: string
  businessAddress?: string | null
  businessPhone?: string | null
  businessCuit?: string | null
  ivaCondition?: string | null
  iibb?: string | null
  razonSocial?: string | null
  domicilioComercial?: string | null
  inicioActividades?: string | null
  receiptType: string
  items: CartItem[]
  subtotal: number
  discount: number
  surcharge: number
  surchargeAmount: number
  total: number
  paymentMethod: string
  paymentSplits?: { method: string; amount: number }[]
  installments: number
  customerName: string
  customerDocTipo?: number
  customerDocNro?: string
  customerIvaCondition?: string
  customerPhone?: string
  sellerName: string
  footer?: string | null
  date: Date
  cae?: string | null
  caeExpiry?: string | null
  invoiceNumber?: number
  puntoVenta?: number
  netoGravado?: number
  ivaAmount?: number
  netoNoGravado?: number
  exento?: number
  // Branding
  logoUrl?: string | null
  primaryColor?: string
  autoPrint?: boolean
}

interface PostSaleModalProps {
  open: boolean
  onClose: () => void
  data: PostSaleData | null
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', debit: 'Tarjeta Débito', credit: 'Tarjeta Crédito',
  transfer: 'Transferencia', account: 'Cuenta Corriente', mixed: 'Pago mixto',
}

export default function PostSaleModal({ open, onClose, data }: PostSaleModalProps) {
  const [showTicket, setShowTicket] = useState(false)

  // Auto-print ticket when autoPrint is enabled
  useEffect(() => {
    if (open && data?.autoPrint && !showTicket) {
      setShowTicket(true)
    }
  }, [open, data?.autoPrint])

  if (!data) return null

  const isInvoice = data.receiptType !== 'ticket'
  const letterLabel = isInvoice ? `Factura ${data.receiptType}` : 'Ticket'

  function handlePrintTicket() {
    setShowTicket(true)
  }

  function handleDownloadPDF() {
    if (!data || !isInvoice) return
    const pdfData: InvoicePDFData = {
      businessName: data.businessName,
      businessCuit: data.businessCuit,
      businessAddress: data.businessAddress,
      businessPhone: data.businessPhone,
      ivaCondition: data.ivaCondition,
      iibb: data.iibb,
      razonSocial: data.razonSocial,
      domicilioComercial: data.domicilioComercial,
      inicioActividades: data.inicioActividades,
      invoiceType: data.receiptType,
      invoiceNumber: data.invoiceNumber || 0,
      puntoVenta: data.puntoVenta || 1,
      cae: data.cae,
      caeExpiry: data.caeExpiry,
      date: data.date,
      customerName: data.customerName || 'Consumidor Final',
      customerDocTipo: data.customerDocTipo,
      customerDocNro: data.customerDocNro,
      customerIvaCondition: data.customerIvaCondition,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      surchargeAmount: data.surchargeAmount,
      total: data.total,
      netoGravado: data.netoGravado,
      ivaAmount: data.ivaAmount,
      netoNoGravado: data.netoNoGravado,
      exento: data.exento,
      paymentMethod: data.paymentMethod,
      installments: data.installments,
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor,
    }
    openInvoicePDF(pdfData)
  }

  function handleWhatsApp() {
    if (!data) return
    if (isInvoice) {
      // Full invoice WhatsApp
      const pdfData: InvoicePDFData = {
        businessName: data.businessName,
        businessCuit: data.businessCuit,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        ivaCondition: data.ivaCondition,
        iibb: data.iibb,
        razonSocial: data.razonSocial,
        domicilioComercial: data.domicilioComercial,
        inicioActividades: data.inicioActividades,
        invoiceType: data.receiptType,
        invoiceNumber: data.invoiceNumber || 0,
        puntoVenta: data.puntoVenta || 1,
        cae: data.cae,
        caeExpiry: data.caeExpiry,
        date: data.date,
        customerName: data.customerName || 'Consumidor Final',
        customerDocTipo: data.customerDocTipo,
        customerDocNro: data.customerDocNro,
        customerIvaCondition: data.customerIvaCondition,
        items: data.items,
        subtotal: data.subtotal,
        discount: data.discount,
        surchargeAmount: data.surchargeAmount,
        total: data.total,
        netoGravado: data.netoGravado,
        ivaAmount: data.ivaAmount,
        netoNoGravado: data.netoNoGravado,
        exento: data.exento,
        paymentMethod: data.paymentMethod,
        installments: data.installments,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
      }
      const url = getWhatsAppLink(pdfData, data.customerPhone)
      window.open(url, '_blank')
    } else {
      // Ticket WhatsApp — simple text summary
      const lines = [
        `🧾 *Ticket de venta*`,
        `Fecha: ${data.date.toLocaleDateString('es-AR')}`,
        ``,
        `*${data.businessName}*`,
        ``,
        ...data.items.map(i => `• ${i.product.name} x${i.quantity} → ${formatCurrency(i.price * i.quantity)}`),
        ``,
        `*TOTAL: ${formatCurrency(data.total)}*`,
        data.customerName ? `Cliente: ${data.customerName}` : '',
        data.footer || '',
      ].filter(Boolean).join('\n')
      const phone = data.customerPhone?.replace(/[^0-9]/g, '') || ''
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank')
    }
  }

  return (
    <>
      <Modal open={open && !showTicket} onClose={onClose} title="" size="sm">
        <div className="space-y-5">
          {/* Success header */}
          <div className="text-center pt-2">
            <div className="w-12 h-12 mx-auto rounded-lg bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-base font-bold text-foreground">Venta registrada</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {letterLabel} por <span className="font-bold text-foreground">{formatCurrency(data.total)}</span>
            </p>
            {data.cae && (
              <p className="text-xs text-muted-foreground mt-1">
                CAE: <span className="font-mono font-semibold">{data.cae}</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {/* Always show ticket print */}
            <button
              onClick={handlePrintTicket}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50/50 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-md bg-slate-50 group-hover:bg-green-50 flex items-center justify-center shrink-0 transition-colors">
                <Printer className="w-5 h-5 text-gray-600 group-hover:text-primary transition" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Imprimir ticket</p>
                <p className="text-xs text-muted-foreground">Impresora térmica 58/80mm</p>
              </div>
            </button>

            {/* PDF download – only for invoices */}
            {isInvoice && (
              <button
                onClick={handleDownloadPDF}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-md bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <Download className="w-5 h-5 text-blue-600 transition" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Descargar PDF</p>
                  <p className="text-xs text-muted-foreground">Factura {data.receiptType} en A4 para el cliente</p>
                </div>
              </button>
            )}

            {/* WhatsApp – for invoices and tickets with phone */}
            {(isInvoice || data.customerPhone) && (
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-md bg-green-50 group-hover:bg-green-100 flex items-center justify-center shrink-0 transition-colors">
                  <MessageCircle className="w-5 h-5 text-green-600 transition" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Enviar por WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    {data.customerPhone ? `Al ${data.customerPhone}` : 'Compartir resumen'}
                  </p>
                </div>
              </button>
            )}
          </div>

          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4" /> Cerrar
          </Button>
        </div>
      </Modal>

      <TicketPrintModal
        open={showTicket}
        onClose={() => setShowTicket(false)}
        data={data ? {
          businessName: data.businessName,
          businessAddress: data.businessAddress,
          businessPhone: data.businessPhone,
          businessCuit: data.businessCuit,
          logoUrl: data.logoUrl,
          primaryColor: data.primaryColor,
          receiptType: data.receiptType,
          items: data.items,
          subtotal: data.subtotal,
          discount: data.discount,
          surcharge: data.surcharge,
          total: data.total,
          paymentMethod: data.paymentMethod,
          paymentSplits: data.paymentSplits,
          installments: data.installments,
          customerName: data.customerName,
          sellerName: data.sellerName,
          footer: data.footer,
          date: data.date,
          cae: data.cae,
          caeExpiry: data.caeExpiry,
          invoiceNumber: data.invoiceNumber,
          puntoVenta: data.puntoVenta,
          netoGravado: data.netoGravado,
          ivaAmount: data.ivaAmount,
        } : null}
      />
    </>
  )
}

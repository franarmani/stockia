import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { isDecimalUnit } from '@/stores/posStore'
import { UNIT_SHORT, type ProductUnit } from '@/types/database'
import { Printer, X } from 'lucide-react'
import type { CartItem } from '@/types/database'

interface TicketData {
  businessName: string
  businessAddress?: string | null
  businessPhone?: string | null
  businessCuit?: string | null
  logoUrl?: string | null
  primaryColor?: string
  receiptType: string
  items: CartItem[]
  subtotal: number
  discount: number
  surcharge: number
  total: number
  paymentMethod: string
  paymentSplits?: { method: string; amount: number }[]
  installments: number
  customerName: string
  sellerName: string
  footer?: string | null
  date: Date
  cae?: string | null
  caeExpiry?: string | null
  invoiceNumber?: number
  puntoVenta?: number
  netoGravado?: number
  ivaAmount?: number
  customerDocTipo?: number
  customerDocNro?: string
}

/** Build AFIP QR URL per RG 4291/2018 spec */
function buildAfipQrUrl(data: TicketData): string | null {
  if (!data.cae || !data.businessCuit || !data.invoiceNumber || !data.puntoVenta) return null
  const cbteTipoMap: Record<string, number> = { A: 1, B: 6, C: 11 }
  const cbteTipo = cbteTipoMap[data.receiptType]
  if (!cbteTipo) return null

  const qrData = {
    ver: 1,
    fecha: data.date.toISOString().slice(0, 10),
    cuit: Number(data.businessCuit.replace(/[^0-9]/g, '')),
    ptoVta: data.puntoVenta,
    tipoCmp: cbteTipo,
    nroCmp: data.invoiceNumber,
    importe: data.total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: data.customerDocTipo || 99,
    nroDocRec: Number(data.customerDocNro?.replace(/[^0-9]/g, '') || '0'),
    tipoCodAut: 'E',
    codAut: Number(data.cae),
  }
  const base64 = btoa(JSON.stringify(qrData))
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

interface TicketPrintModalProps {
  open: boolean
  onClose: () => void
  data: TicketData | null
  width?: '58mm' | '80mm'
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  debit: 'Tarjeta Débito',
  credit: 'Tarjeta Crédito',
  transfer: 'Transferencia',
  account: 'Cuenta Corriente',
}

export default function TicketPrintModal({ open, onClose, data, width = '80mm' }: TicketPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedWidth, setSelectedWidth] = useState(width)

  useEffect(() => { setSelectedWidth(width) }, [width])

  if (!data) return null

  const is58 = selectedWidth === '58mm'
  const maxChars = is58 ? 32 : 48

  function handlePrint() {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return

    const accentColor = data.primaryColor || '#1DB954'
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket</title>
        <style>
          @page { margin: 0; size: ${selectedWidth} auto; }
          body {
            margin: 0;
            padding: 4px;
            font-family: 'Courier New', monospace;
            font-size: ${is58 ? '10px' : '12px'};
            line-height: 1.3;
            color: #000;
            width: ${selectedWidth};
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .right { text-align: right; }
          .sep { border-top: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; }
          .item-name { max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .big { font-size: ${is58 ? '14px' : '16px'}; }
          .small { font-size: ${is58 ? '8px' : '10px'}; }
          .biz-name { color: ${accentColor}; }
          .total-row { color: ${accentColor}; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const receiptLabel = data.receiptType === 'ticket' ? 'TICKET' : `FACTURA ${data.receiptType}`

  return (
    <Modal open={open} onClose={onClose} title="Imprimir ticket" size="sm">
      <div className="space-y-4">
        {/* Width selector */}
        <div className="flex gap-2">
          <button onClick={() => setSelectedWidth('58mm')}
            className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition ${
              selectedWidth === '58mm' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-muted-foreground'
            }`}>58mm</button>
          <button onClick={() => setSelectedWidth('80mm')}
            className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition ${
              selectedWidth === '80mm' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-muted-foreground'
            }`}>80mm</button>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden max-h-[50vh] overflow-y-auto">
          <div
            ref={printRef}
            className="p-4 mx-auto font-mono text-[11px] leading-tight"
            style={{ maxWidth: selectedWidth === '58mm' ? '220px' : '300px' }}
          >
            {/* Header */}
            <div className="text-center mb-2">
              {data.logoUrl && (
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="inline-block mb-1"
                  style={{ maxWidth: is58 ? '80px' : '120px', maxHeight: '48px', objectFit: 'contain' }}
                />
              )}
              <p className="font-bold text-sm" style={{ color: data.primaryColor || '#1DB954' }}>{data.businessName}</p>
              {data.businessAddress && <p className="text-[10px]">{data.businessAddress}</p>}
              {data.businessPhone && <p className="text-[10px]">Tel: {data.businessPhone}</p>}
              {data.businessCuit && <p className="text-[10px]">CUIT: {data.businessCuit}</p>}
            </div>

            {/* Receipt type */}
            <div className="text-center border-t border-dashed border-gray-400 pt-1 mb-1">
              <p className="font-bold">{receiptLabel}</p>
              {data.invoiceNumber && data.puntoVenta && (
                <p className="text-[10px] font-bold">
                  Nro: {String(data.puntoVenta).padStart(5, '0')}-{String(data.invoiceNumber).padStart(8, '0')}
                </p>
              )}
              <p className="text-[10px]">
                {data.date.toLocaleDateString('es-AR')} {data.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-1" />

            {/* Items */}
            <div className="space-y-0.5">
              {data.items.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="truncate flex-1 mr-1">{item.product.name}</span>
                    <span className="font-bold whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                  <p className="text-[9px] text-gray-500 pl-1">
                    {isDecimalUnit(item.product.unit) ? item.quantity.toFixed(2) : item.quantity} {UNIT_SHORT[(item.product.unit || 'u') as ProductUnit]} x {formatCurrency(item.price)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-1" />

            {/* Totals */}
            <div className="space-y-0.5">
              {data.discount > 0 && (
                <div className="flex justify-between">
                  <span>Desc. {data.discount}%</span>
                  <span>-{formatCurrency(data.subtotal * data.discount / 100)}</span>
                </div>
              )}
              {data.surcharge > 0 && (
                <div className="flex justify-between">
                  <span>Rec. {data.surcharge}%</span>
                  <span>+{formatCurrency(data.subtotal * (1 - data.discount / 100) * data.surcharge / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm" style={{ color: data.primaryColor || '#1DB954' }}>
                <span>TOTAL</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
              {data.receiptType === 'A' && data.netoGravado != null && data.ivaAmount != null && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>Neto gravado</span>
                    <span>{formatCurrency(data.netoGravado)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>IVA 21%</span>
                    <span>{formatCurrency(data.ivaAmount)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-1" />

            {/* Payment info */}
            <div className="space-y-0.5 text-[10px]">
              {data.paymentSplits && data.paymentSplits.length > 1 ? (
                <>
                  <p className="font-bold">Pago mixto:</p>
                  {data.paymentSplits.map((split, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{PAYMENT_LABELS[split.method] || split.method}</span>
                      <span>{formatCurrency(split.amount)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Pago:</span>
                  <span>{PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}</span>
                </div>
              )}
              {data.installments > 1 && (
                <div className="flex justify-between">
                  <span>Cuotas:</span>
                  <span>{data.installments}x {formatCurrency(data.total / data.installments)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{data.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Vendedor:</span>
                <span>{data.sellerName}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-1" />

            {/* CAE AFIP */}
            {data.cae && (
              <>
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>CAE:</span>
                    <span>{data.cae}</span>
                  </div>
                  {data.caeExpiry && (
                    <div className="flex justify-between">
                      <span>Vto. CAE:</span>
                      <span>{data.caeExpiry}</span>
                    </div>
                  )}
                </div>
                {/* AFIP QR Code */}
                {buildAfipQrUrl(data) && (
                  <div className="text-center my-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(buildAfipQrUrl(data)!)}`}
                      alt="QR AFIP"
                      className="inline-block"
                      style={{ width: is58 ? '80px' : '120px', height: is58 ? '80px' : '120px' }}
                    />
                    <p className="text-[8px] text-gray-500 mt-0.5">Comprobante válido como factura</p>
                  </div>
                )}
                <div className="border-t border-dashed border-gray-400 my-1" />
              </>
            )}

            {/* Footer */}
            <div className="text-center text-[10px]">
              {data.footer ? (
                <p>{data.footer}</p>
              ) : (
                <p>¡Gracias por su compra!</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="w-4 h-4" /> Cerrar
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>
    </Modal>
  )
}

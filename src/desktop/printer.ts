import { openPrintFrame } from '@/lib/documentLayout'
/**
 * CajaGo — Thermal Ticket & Receipt Printing Module
 * Formats: 58mm and 80mm ESC/POS compatible thermal paper widths.
 */

export interface ReceiptItem {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface ReceiptData {
  businessName: string
  businessCuit?: string
  businessAddress?: string
  businessPhone?: string
  receiptNumber: string
  date: string
  items: ReceiptItem[]
  subtotal: number
  discount?: number
  total: number
  paymentMethod: string
  customerName?: string
  customerCuit?: string
  cae?: string | null
  caeDueDate?: string | null
  barcodeUrl?: string
  isOfflineTicket?: boolean
}

export function printThermalReceipt(data: ReceiptData, format: '58mm' | '80mm' = '80mm') {
  const printWindow = openPrintFrame()

  const is58 = format === '58mm'
  const widthClass = is58 ? 'width: 48mm; font-size: 11px;' : 'width: 72mm; font-size: 12px;'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket #${data.receiptNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            margin: 0;
            size: ${is58 ? '58mm' : '80mm'} auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 4mm;
            color: #000;
            ${widthClass}
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; }
          .badge {
            display: inline-block;
            border: 1px solid #000;
            padding: 1px 4px;
            font-size: 10px;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold" style="font-size: 14px;">${data.businessName.toUpperCase()}</div>
          ${data.businessCuit ? `<div>CUIT: ${data.businessCuit}</div>` : ''}
          ${data.businessAddress ? `<div>${data.businessAddress}</div>` : ''}
          ${data.businessPhone ? `<div>Tel: ${data.businessPhone}</div>` : ''}
          <div class="divider"></div>
          <div class="bold">
            ${data.cae ? 'COMPROBANTE ELECTRÓNICO' : 'TICKET DE VENTA (NO FISCAL)'}
          </div>
          <div>Nº: ${data.receiptNumber}</div>
          <div>Fecha: ${data.date}</div>
          ${data.isOfflineTicket ? '<div class="badge bold">EMITIDO OFFLINE</div>' : ''}
          ${data.customerName ? `<div class="divider"></div><div>Cliente: ${data.customerName}</div>` : ''}
          ${data.customerCuit ? `<div>CUIT/DNI: ${data.customerCuit}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <div>
          ${data.items
            .map(
              (item) => `
            <div class="row">
              <span>${item.quantity}x ${item.name}</span>
              <span class="bold">$${item.subtotal.toLocaleString('es-AR')}</span>
            </div>
            ${item.quantity > 1 ? `<div style="font-size: 10px; color: #555;">($${item.unit_price.toLocaleString('es-AR')} c/u)</div>` : ''}
          `
            )
            .join('')}
        </div>

        <div class="double-divider"></div>

        <div class="row bold" style="font-size: 14px;">
          <span>TOTAL:</span>
          <span>$${data.total.toLocaleString('es-AR')}</span>
        </div>
        <div class="row" style="font-size: 11px;">
          <span>Pago:</span>
          <span>${data.paymentMethod.toUpperCase()}</span>
        </div>

        ${
          data.cae
            ? `
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px;">
            <div class="bold">CAE: ${data.cae}</div>
            <div>Vto. CAE: ${data.caeDueDate || '-'}</div>
          </div>
        `
            : ''
        }

        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 6px;">
          <div>¡Gracias por su compra!</div>
          <div>CajaGo · cajago.com</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * STOCKIA – Invoice PDF Generator (Server-side, PDFKit)
 * Generates A4 PDF for Factura A/B/C with CAE + QR
 */

const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

const IVA_LABELS = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Exento',
  consumidor_final: 'IVA Consumidor Final',
}

const DOC_LABELS = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: 'Sin identificar',
}

const INVOICE_TYPE_COLORS = {
  A: '#1d4ed8',
  B: '#1DB954',
  C: '#7c3aed',
}

function pad(n, len) {
  return String(n).padStart(len, '0')
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(d) {
  if (typeof d === 'string') d = new Date(d)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Build the AFIP QR URL for the invoice
 */
function buildQrUrl(data) {
  const cbteTipoMap = { A: 1, B: 6, C: 11 }
  const qrData = {
    ver: 1,
    fecha: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date,
    cuit: Number(String(data.businessCuit).replace(/[^0-9]/g, '')),
    ptoVta: data.puntoVenta,
    tipoCmp: cbteTipoMap[data.invoiceType] || 11,
    nroCmp: data.invoiceNumber,
    importe: data.total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: data.customerDocTipo || 99,
    nroDocRec: Number(String(data.customerDocNro || '0').replace(/[^0-9]/g, '')) || 0,
    tipoCodAut: 'E',
    codAut: Number(data.cae),
  }
  const encoded = Buffer.from(JSON.stringify(qrData)).toString('base64')
  return `https://www.afip.gob.ar/fe/qr/?p=${encoded}`
}

/**
 * Generate invoice PDF and return as base64 string
 */
async function generateInvoicePDF(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      })

      const buffers = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer.toString('base64'))
      })

      const color = INVOICE_TYPE_COLORS[data.invoiceType] || '#333'
      const pageWidth = 515 // A4 width minus margins

      // === HEADER ===
      // Left side: business info
      doc.fontSize(14).font('Helvetica-Bold').text(data.businessName, 40, 40, { width: 220 })
      doc.fontSize(8).font('Helvetica')
      doc.text(`CUIT: ${data.businessCuit}`, 40, 58, { width: 220 })
      doc.text(`${IVA_LABELS[data.ivaCondition] || data.ivaCondition}`, 40, 70)
      if (data.businessAddress) doc.text(data.businessAddress, 40, 82, { width: 220 })

      // Invoice type letter (centered)
      const letterX = (pageWidth / 2) - 15 + 40
      doc.rect(letterX, 40, 30, 30).fill(color)
      doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold')
        .text(data.invoiceType, letterX, 45, { width: 30, align: 'center' })
      doc.fillColor('#333')

      // Right side: invoice number + date
      const rightX = 320
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Factura ${data.invoiceType}`, rightX, 40, { width: 235, align: 'right' })
      doc.fontSize(9).font('Helvetica')
        .text(`Punto de Venta: ${pad(data.puntoVenta, 5)} — Comp. Nro: ${pad(data.invoiceNumber, 8)}`, rightX, 55, { width: 235, align: 'right' })
      doc.text(`Fecha: ${formatDate(data.date)}`, rightX, 70, { width: 235, align: 'right' })

      // Separator
      doc.moveTo(40, 100).lineTo(555, 100).stroke('#ddd')

      // === CUSTOMER INFO ===
      let y = 110
      doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL RECEPTOR', 40, y)
      y += 14
      doc.font('Helvetica').fontSize(8)
      doc.text(`Nombre/Razón Social: ${data.customerName || 'Consumidor Final'}`, 40, y, { width: 300 })
      doc.text(`${DOC_LABELS[data.customerDocTipo] || 'Doc'}: ${data.customerDocNro || '-'}`, 360, y, { width: 195 })
      y += 20

      doc.moveTo(40, y).lineTo(555, y).stroke('#ddd')
      y += 10

      // === ITEMS TABLE ===
      doc.fontSize(8).font('Helvetica-Bold')
      doc.text('Descripción', 40, y, { width: 230 })
      doc.text('Cant.', 280, y, { width: 50, align: 'right' })
      doc.text('P. Unit.', 340, y, { width: 70, align: 'right' })
      if (data.invoiceType === 'A') doc.text('IVA', 420, y, { width: 50, align: 'right' })
      doc.text('Subtotal', 480, y, { width: 75, align: 'right' })

      y += 4
      doc.moveTo(40, y).lineTo(555, y).stroke('#eee')
      y += 6

      doc.font('Helvetica').fontSize(8)
      const items = data.items || []
      for (const item of items) {
        if (y > 680) {
          doc.addPage()
          y = 40
        }
        const desc = item.description || item.product?.name || 'Producto'
        const qty = Number(item.qty || item.quantity || 1)
        const price = Number(item.unit_price || item.price || 0)
        const iva = Number(item.iva_rate || 21)
        const subtotal = Number(item.total || qty * price)

        doc.text(desc, 40, y, { width: 230 })
        doc.text(String(qty), 280, y, { width: 50, align: 'right' })
        doc.text(formatCurrency(price), 340, y, { width: 70, align: 'right' })
        if (data.invoiceType === 'A') doc.text(`${iva}%`, 420, y, { width: 50, align: 'right' })
        doc.text(formatCurrency(subtotal), 480, y, { width: 75, align: 'right' })
        y += 14
      }

      y += 10
      doc.moveTo(40, y).lineTo(555, y).stroke('#ddd')
      y += 10

      // === TOTALS ===
      const totalsX = 380
      if (data.invoiceType === 'A' && data.netoGravado) {
        doc.font('Helvetica').fontSize(9)
        doc.text('Neto Gravado:', totalsX, y, { width: 100 })
        doc.text(formatCurrency(data.netoGravado), 490, y, { width: 65, align: 'right' })
        y += 14
        doc.text('IVA 21%:', totalsX, y, { width: 100 })
        doc.text(formatCurrency(data.ivaAmount), 490, y, { width: 65, align: 'right' })
        y += 14
      }

      doc.font('Helvetica-Bold').fontSize(11)
      doc.text('TOTAL:', totalsX, y, { width: 100 })
      doc.text(formatCurrency(data.total), 480, y, { width: 75, align: 'right' })
      y += 25

      // === CAE ===
      if (data.cae) {
        doc.moveTo(40, y).lineTo(555, y).stroke('#ddd')
        y += 10

        doc.font('Helvetica-Bold').fontSize(8)
        doc.text(`CAE: ${data.cae}`, 40, y)
        const caeVtoStr = data.caeVto
          ? `${data.caeVto.slice(0, 4)}-${data.caeVto.slice(4, 6)}-${data.caeVto.slice(6, 8)}`
          : '-'
        doc.text(`Vto. CAE: ${caeVtoStr}`, 40, y + 12)

        // QR Code
        try {
          const qrUrl = buildQrUrl(data)
          const qrPng = await QRCode.toBuffer(qrUrl, { width: 100, margin: 1 })
          doc.image(qrPng, 455, y - 5, { width: 100 })
        } catch {
          doc.text('QR no disponible', 455, y, { width: 100 })
        }
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { generateInvoicePDF }

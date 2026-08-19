/**
 * Layout A4 compartido por facturas y presupuestos.
 *
 * Ambos documentos usan el mismo header (logo + datos del emisor a la
 * izquierda, bloque de documento a la derecha), la misma tabla de ítems y el
 * mismo bloque de totales. Lo que cambia es el título, los metadatos y lo que
 * va debajo de los totales (CAE en factura, validez y leyenda en presupuesto).
 */

/** El PDF se abre en about:blank, donde las URLs relativas no resuelven. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?:|data:)/.test(url)) return url
  return new URL(url, window.location.origin).href
}

export interface EmitterData {
  businessName: string
  businessCuit?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  razonSocial?: string | null
  domicilioComercial?: string | null
  ivaConditionLabel?: string
  iibb?: string | null
  inicioActividades?: string | null
  logoUrl?: string | null
}

export function documentStyles(color: string): string {
  return `
    @page { margin: 0; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #f3f4f6; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      padding: 22mm 20mm 18mm;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .logo { max-width: 150px; max-height: 62px; object-fit: contain; display: block; margin-bottom: 14px; }
    .logo-fallback {
      font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
      color: ${color}; margin-bottom: 12px;
    }
    .emitter { font-size: 12px; color: #4b5563; }
    .emitter .name { font-size: 14px; font-weight: 700; color: #111827; }
    .doc-block { text-align: right; white-space: nowrap; }
    .doc-title { font-size: 17px; font-weight: 800; letter-spacing: 0.01em; color: #111827; }
    .doc-title span { color: ${color}; }
    .doc-meta { font-size: 12px; color: #4b5563; margin-top: 3px; }
    .letter-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border: 2px solid ${color}; border-radius: 6px;
      font-size: 24px; font-weight: 900; color: ${color}; margin-bottom: 8px;
    }

    /* Cliente */
    .block-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 6px; }
    .customer { margin-top: 34px; font-size: 12px; color: #4b5563; }

    /* Ítems */
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    thead th {
      font-size: 12px; font-weight: 700; color: #111827;
      padding: 10px 8px; border-bottom: 1px solid #d1d5db; border-top: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.num, td.num { text-align: right; }
    tbody td {
      padding: 12px 8px; border-bottom: 1px solid #e5e7eb;
      color: #6b7280; vertical-align: top;
    }
    tbody td.strong { color: #111827; font-weight: 600; }
    .item-name { color: #4b5563; }
    .item-brand { color: #9ca3af; font-size: 11px; margin-left: 4px; }

    /* Totales */
    .totals { margin-top: 26px; display: flex; justify-content: flex-end; }
    .totals-box { width: 62%; }
    .totals-box .row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 10px 8px; border-bottom: 1px solid #e5e7eb;
      font-size: 12px; color: #6b7280;
    }
    .totals-box .row .pct { color: #9ca3af; flex: 0 0 70px; text-align: left; }
    .totals-box .row .label { flex: 1; }
    .totals-box .row .val { color: #4b5563; }
    .totals-box .row.grand {
      border-bottom: none; border-top: 1px solid #d1d5db;
      padding-top: 12px; margin-top: 2px;
    }
    .totals-box .row.grand .label { font-size: 14px; font-weight: 700; color: #111827; }
    .totals-box .row.grand .val { font-size: 15px; font-weight: 800; color: ${color}; }

    /* Caja destacada (CAE en factura, validez en presupuesto) */
    .callout {
      margin-top: 28px; padding: 14px 16px;
      border: 1px solid #e5e7eb; border-radius: 8px;
      display: flex; justify-content: space-between; align-items: center; gap: 20px;
    }
    .callout-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; }
    .callout-value { font-size: 15px; font-weight: 800; color: #111827; letter-spacing: 0.04em; }
    .callout-sub { font-size: 12px; font-weight: 600; color: #4b5563; }
    .qr { width: 96px; height: 96px; }

    /* Notas */
    .notes { margin-top: 24px; font-size: 12px; color: #4b5563; }
    .notes p.body { white-space: pre-wrap; }

    /* Footer */
    .spacer { flex: 1; min-height: 30px; }
    .footer {
      font-size: 11px; color: #6b7280; line-height: 1.6;
      max-width: 62%; padding-top: 14px;
    }
    .legal { margin-top: 10px; font-size: 10px; color: #9ca3af; }
  `
}

/** Bloque logo + datos del emisor. Sin logo cargado, el nombre del negocio. */
export function emitterBlock(data: EmitterData): string {
  const logoSrc = absoluteUrl(data.logoUrl)
  return `
      <div>
        ${logoSrc
          ? `<img class="logo" src="${logoSrc}" alt="Logo" />`
          : `<p class="logo-fallback">${data.razonSocial || data.businessName}</p>`}
        <div class="emitter">
          <p class="name">${data.razonSocial || data.businessName}</p>
          ${data.domicilioComercial || data.businessAddress ? `<p>${data.domicilioComercial || data.businessAddress}</p>` : ''}
          ${data.businessPhone ? `<p>${data.businessPhone}</p>` : ''}
          ${data.businessCuit ? `<p>CUIT: ${data.businessCuit}</p>` : ''}
          ${data.ivaConditionLabel ? `<p>Cond. IVA: ${data.ivaConditionLabel}</p>` : ''}
          ${data.iibb ? `<p>IIBB: ${data.iibb}</p>` : ''}
          ${data.inicioActividades ? `<p>Inicio de actividades: ${data.inicioActividades}</p>` : ''}
        </div>
      </div>`
}

/**
 * Espera a que carguen logo y QR antes de imprimir: si disparamos print()
 * antes, esas imágenes salen en blanco.
 */
export const printOnReadyScript = `<script>
  (function () {
    var imgs = Array.prototype.slice.call(document.images)
    var pending = imgs.filter(function (img) { return !img.complete }).length
    var done = false
    function go() {
      if (done) return
      done = true
      setTimeout(function () { window.print() }, 150)
    }
    if (!pending) { go(); return }
    imgs.forEach(function (img) {
      if (img.complete) return
      img.addEventListener('load', function () { if (--pending === 0) go() })
      img.addEventListener('error', function () { if (--pending === 0) go() })
    })
    setTimeout(go, 3000) // red lenta: imprimimos igual
  })()
</script>`

/** Abre un documento HTML en ventana nueva para imprimir o guardar como PDF. */
export function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

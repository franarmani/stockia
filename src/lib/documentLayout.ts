/**
 * Layout A4 compartido por facturas y presupuestos.
 *
 * Ambos documentos usan el mismo header (logo + datos del emisor a la
 * izquierda, bloque de documento a la derecha), la misma tabla de ítems y el
 * mismo bloque de totales. Lo que cambia es el título, los metadatos y lo que
 * va debajo de los totales (CAE en factura, validez y leyenda en presupuesto).
 *
 * Cada documento se genera en dos variantes: a color (usa el color de marca
 * del negocio) y en blanco y negro, que es como se imprime habitualmente.
 */

/** Variante de impresión. 'bw' evita gastar tóner de color. */
export type PrintMode = 'color' | 'bw'

/** El PDF se abre en about:blank, donde las URLs relativas no resuelven. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?:|data:)/.test(url)) return url
  return new URL(url, window.location.origin).href
}

/** En blanco y negro el acento pasa a negro; el resto de la paleta ya es gris. */
export function resolveAccent(color: string, mode: PrintMode): string {
  return mode === 'bw' ? '#111827' : color
}

export interface EmitterData {
  businessName: string
  businessCuit?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  businessEmail?: string | null
  razonSocial?: string | null
  domicilioComercial?: string | null
  ivaConditionLabel?: string
  iibb?: string | null
  inicioActividades?: string | null
  puntoVenta?: number | null
  logoUrl?: string | null
}

export function documentStyles(color: string, mode: PrintMode = 'color'): string {
  const accent = resolveAccent(color, mode)
  // En B/N el logo va en grises para que no salga apagado ni manche de color.
  const logoFilter = mode === 'bw' ? 'filter: grayscale(100%) contrast(1.1);' : ''
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
      padding: 18mm 18mm 16mm;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .top {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 28px; padding-bottom: 18px;
      border-bottom: 2px solid ${accent};
    }
    .brand { min-width: 0; }
    .logo {
      max-width: 260px; max-height: 110px; object-fit: contain;
      display: block; margin-bottom: 14px; ${logoFilter}
    }
    .logo-fallback {
      font-size: 30px; font-weight: 800; letter-spacing: -0.025em;
      line-height: 1.15; color: ${accent}; margin-bottom: 12px;
      max-width: 320px;
    }
    .emitter { font-size: 11.5px; color: #4b5563; }
    .emitter .name {
      font-size: 15px; font-weight: 700; color: #111827;
      margin-bottom: 2px; letter-spacing: -0.01em;
    }
    .emitter .fiscal {
      margin-top: 7px; padding-top: 7px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px; color: #6b7280;
    }

    /* Bloque del documento, a la derecha */
    .doc-block { text-align: right; white-space: nowrap; flex-shrink: 0; }
    .letter-badge {
      display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
      width: 62px; height: 62px; border: 2.5px solid ${accent}; border-radius: 8px;
      margin-bottom: 10px;
    }
    .letter-badge .letter {
      font-size: 34px; font-weight: 900; color: ${accent};
      line-height: 1; letter-spacing: -0.02em;
    }
    .letter-badge .code {
      font-size: 8px; font-weight: 700; color: #9ca3af;
      letter-spacing: 0.05em; margin-top: 2px;
    }
    .doc-title {
      font-size: 21px; font-weight: 800; color: #111827;
      letter-spacing: 0.02em; line-height: 1.15;
    }
    .doc-kind {
      font-size: 11px; font-weight: 700; color: ${accent};
      text-transform: uppercase; letter-spacing: 0.09em; margin-top: 3px;
    }
    .doc-number {
      font-size: 15px; font-weight: 700; color: #374151;
      margin-top: 6px; font-variant-numeric: tabular-nums;
    }
    .doc-meta {
      font-size: 11.5px; color: #6b7280; margin-top: 3px;
      font-variant-numeric: tabular-nums;
    }
    .doc-meta strong { color: #374151; font-weight: 600; }

    /* ── Cliente ── */
    .block-title {
      font-size: 9.5px; font-weight: 700; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 7px;
    }
    .customer { margin-top: 26px; font-size: 12px; color: #4b5563; }
    .customer .cname { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 2px; }
    .customer-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px 28px; margin-top: 6px;
    }
    .customer-grid .field { font-size: 11.5px; }
    .customer-grid .field span { color: #9ca3af; }

    /* ── Ítems ── */
    table { width: 100%; border-collapse: collapse; margin-top: 26px; }
    thead th {
      font-size: 9.5px; font-weight: 700; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.07em;
      padding: 9px 8px; text-align: left;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb; border-bottom: 1px solid #d1d5db;
    }
    thead th.num, td.num { text-align: right; }
    tbody td {
      padding: 11px 8px; border-bottom: 1px solid #f0f1f3;
      color: #4b5563; vertical-align: top;
      font-variant-numeric: tabular-nums;
    }
    tbody tr:last-child td { border-bottom: 1px solid #d1d5db; }
    tbody td.desc { font-variant-numeric: normal; }
    tbody td.strong { color: #111827; font-weight: 600; }
    .item-name { color: #1f2937; }
    .item-brand { color: #9ca3af; font-size: 10.5px; margin-left: 5px; }

    /* ── Totales ── */
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-box { width: 58%; min-width: 300px; }
    .totals-box .row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 7px 8px; font-size: 12px; color: #6b7280;
      font-variant-numeric: tabular-nums;
    }
    .totals-box .row + .row { border-top: 1px solid #f0f1f3; }
    .totals-box .row .pct { color: #9ca3af; flex: 0 0 62px; text-align: left; font-size: 11px; }
    .totals-box .row .label { flex: 1; }
    .totals-box .row .val { color: #4b5563; font-weight: 500; }
    .totals-box .row.grand {
      border-top: 2px solid ${accent}; margin-top: 4px;
      padding-top: 11px; padding-bottom: 4px;
    }
    .totals-box .row.grand .label {
      font-size: 13px; font-weight: 700; color: #111827;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .totals-box .row.grand .val { font-size: 19px; font-weight: 800; color: ${accent}; }

    /* ── Caja destacada (CAE en factura, validez en presupuesto) ── */
    .callout {
      margin-top: 24px; padding: 14px 16px;
      border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa;
      display: flex; justify-content: space-between; align-items: center; gap: 20px;
    }
    .callout-label {
      font-size: 9.5px; text-transform: uppercase;
      letter-spacing: 0.07em; color: #9ca3af;
    }
    .callout-value {
      font-size: 15px; font-weight: 800; color: #111827;
      letter-spacing: 0.03em; font-variant-numeric: tabular-nums;
    }
    .callout-sub { font-size: 12px; font-weight: 600; color: #4b5563; }
    .qr { width: 92px; height: 92px; ${logoFilter} }

    /* ── Notas ── */
    .notes { margin-top: 20px; font-size: 11.5px; color: #4b5563; }
    .notes p.body { white-space: pre-wrap; line-height: 1.65; }

    /* ── Footer ── */
    .spacer { flex: 1; min-height: 24px; }
    .footer {
      border-top: 1px solid #e5e7eb; padding-top: 12px;
      font-size: 11px; color: #6b7280; line-height: 1.6;
    }
    .footer .message {
      color: #374151; font-weight: 600; margin-bottom: 4px;
    }
    .legal { margin-top: 8px; font-size: 9.5px; color: #9ca3af; line-height: 1.55; }
  `
}

/**
 * Bloque logo + datos del emisor. Sin logo cargado usa el nombre del negocio
 * en grande, para que el documento nunca salga sin identificación.
 */
export function emitterBlock(data: EmitterData): string {
  const logoSrc = absoluteUrl(data.logoUrl)
  const fiscal = [
    data.businessCuit ? `CUIT: ${data.businessCuit}` : '',
    data.ivaConditionLabel ? `Cond. IVA: ${data.ivaConditionLabel}` : '',
    data.iibb ? `IIBB: ${data.iibb}` : '',
    data.inicioActividades ? `Inicio de actividades: ${data.inicioActividades}` : '',
    data.puntoVenta ? `Punto de venta: ${String(data.puntoVenta).padStart(5, '0')}` : '',
  ].filter(Boolean)

  const contact = [
    data.domicilioComercial || data.businessAddress || '',
    data.businessPhone ? `Tel: ${data.businessPhone}` : '',
    data.businessEmail || '',
  ].filter(Boolean)

  return `
      <div class="brand">
        ${logoSrc
          ? `<img class="logo" src="${logoSrc}" alt="Logo" />`
          : `<p class="logo-fallback">${data.razonSocial || data.businessName}</p>`}
        <div class="emitter">
          <p class="name">${data.razonSocial || data.businessName}</p>
          ${contact.map(l => `<p>${l}</p>`).join('')}
          ${fiscal.length > 0 ? `<div class="fiscal">${fiscal.map(l => `<p>${l}</p>`).join('')}</div>` : ''}
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

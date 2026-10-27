// Tablas en celular: cada fila pasa a ser una tarjeta con "Etiqueta: valor" (ver .app-shell table en index.css).
// Las etiquetas salen de los encabezados de cada tabla; se marcan solas en toda la aplicación.
// Para excluir una tabla: <table data-no-stack>.

function label(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th, thead td'))
  if (headers.length === 0) return
  const names = headers.map((header) => (header.textContent ?? '').replace(/\s+/g, ' ').trim())
  table.setAttribute('data-stack', '')
  for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'))) {
    const cells = Array.from(row.children) as HTMLElement[]
    cells.forEach((cell, index) => {
      if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return
      if ((cell.getAttribute('colspan') ?? '1') !== '1') { cell.setAttribute('data-wide', ''); return }
      const name = names[index] ?? ''
      if (cell.getAttribute('data-label') !== name) cell.setAttribute('data-label', name)
    })
  }
}

export function installStackedTables() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  let scheduled = false
  const run = () => {
    scheduled = false
    document.querySelectorAll<HTMLTableElement>('.app-shell table:not([data-no-stack])').forEach(label)
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(run)
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  schedule()
}

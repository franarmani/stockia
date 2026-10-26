/**
 * CajaGo — POS Keyboard Shortcuts & USB Barcode Scanner Buffer
 * Enhances desktop & browser experience for high-speed counter operations.
 */

export interface POSShortcutsOptions {
  onCobrar?: () => void
  onSearchFocus?: () => void
  onClear?: () => void
  onBarcodeScan?: (barcode: string) => void
}

export function registerPOSShortcuts(options: POSShortcutsOptions): () => void {
  let barcodeBuffer = ''
  let lastKeyTime = 0

  const handleKeyDown = (e: KeyboardEvent) => {
    // 1. Functional Keys
    if (e.key === 'F2') {
      e.preventDefault()
      options.onCobrar?.()
      return
    }

    if (e.key === 'F4') {
      e.preventDefault()
      options.onSearchFocus?.()
      return
    }

    if (e.key === 'Escape') {
      options.onClear?.()
      return
    }

    // 2. USB Barcode Scanner Auto-Detection Buffer
    // USB barcode scanners simulate a keyboard typing characters rapidly (< 40ms interval) ending with 'Enter'.
    const now = Date.now()
    const diff = now - lastKeyTime
    lastKeyTime = now

    // If typing is very fast or buffer is accumulating
    if (diff > 80) {
      barcodeBuffer = ''
    }

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 6) {
        e.preventDefault()
        const scannedCode = barcodeBuffer.trim()
        barcodeBuffer = ''
        options.onBarcodeScan?.(scannedCode)
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      barcodeBuffer += e.key
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}

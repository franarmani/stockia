/**
 * CajaGo — Migración de la cola offline anterior (IndexedDB "stockia_offline").
 * Versiones viejas guardaban las ventas sin conexión ahí. Las pasamos a la cola unificada
 * una sola vez y borramos la base vieja cuando queda vacía.
 */

import type { LocalSalePayload } from './types'

const LEGACY_DB_NAME = 'stockia_offline'
const LEGACY_STORE = 'pending_sales'

export interface LegacyOfflineSale {
  id: string
  createdAt: string
  payload: {
    sale: Record<string, any>
    items: Record<string, any>[]
    payments: Record<string, any>[]
    stockUpdates: { productId: string; newStock: number; qty: number }[]
    accountUpdate?: { customerId: string; amount: number }
  }
}

/** Convierte una venta de la cola vieja al formato de la cola unificada (con IDs idempotentes). */
export function legacySaleToPayload(legacy: LegacyOfflineSale): LocalSalePayload {
  const saleId = crypto.randomUUID()
  const sale = legacy.payload.sale
  return {
    sale: {
      id: saleId,
      business_id: sale.business_id,
      customer_id: sale.customer_id ?? null,
      total: Number(sale.total) || 0,
      discount: Number(sale.discount) || 0,
      payment_method: sale.payment_method || 'cash',
      seller_id: sale.seller_id,
      receipt_type: 'ticket',
      installments: sale.installments ?? 1,
      surcharge_pct: Number(sale.surcharge_pct) || 0,
      note: sale.note ?? null,
      fiscal_status: 'pending',
      device_id: '',
      created_at: legacy.createdAt || new Date().toISOString(),
    },
    items: legacy.payload.items.map((item) => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      product_id: item.product_id,
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      cost_at_sale: Number(item.cost_at_sale) || 0,
    })),
    payments: legacy.payload.payments.map((payment) => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      payment_method: payment.payment_method,
      amount: Number(payment.amount) || 0,
    })),
    stockUpdates: legacy.payload.stockUpdates.map((update) => ({
      productId: update.productId,
      newStock: update.newStock,
      qty: update.qty,
      movementId: crypto.randomUUID(),
    })),
    accountUpdate: legacy.payload.accountUpdate ?? null,
  }
}

async function legacyDbExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  if (typeof indexedDB.databases !== 'function') return true
  try {
    const databases = await indexedDB.databases()
    return databases.some((db) => db.name === LEGACY_DB_NAME)
  } catch {
    return true
  }
}

function openLegacyDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(LEGACY_DB_NAME)
    // Si hay que "crearla", no existía: abortamos para no dejar una base vacía.
    req.onupgradeneeded = () => req.transaction?.abort()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

export async function migrateLegacyOfflineSales(
  enqueue: (payload: LocalSalePayload, legacyId: string) => Promise<void>
): Promise<number> {
  if (!(await legacyDbExists())) return 0
  const db = await openLegacyDb()
  if (!db) return 0

  try {
    if (!db.objectStoreNames.contains(LEGACY_STORE)) return 0
    const legacySales: LegacyOfflineSale[] = await new Promise((resolve, reject) => {
      const req = db.transaction(LEGACY_STORE, 'readonly').objectStore(LEGACY_STORE).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    let migrated = 0
    for (const legacy of legacySales) {
      await enqueue(legacySaleToPayload(legacy), legacy.id)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LEGACY_STORE, 'readwrite')
        tx.objectStore(LEGACY_STORE).delete(legacy.id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      migrated++
    }
    return migrated
  } finally {
    db.close()
  }
}

/**
 * Offline Queue System
 *
 * Queues sales in IndexedDB when offline.
 * Syncs to Supabase when connectivity returns.
 * AFIP invoices are NOT generated offline — only queued sales with receipt_type='ticket'.
 */

const DB_NAME = 'stockia_offline'
const DB_VERSION = 2
const STORE_NAME = 'pending_sales'

export interface OfflineSale {
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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      if (oldVersion < 2) {
        // products_cache is created in offlineProductsCache.ts
        if (!db.objectStoreNames.contains('products_cache')) {
          const store = db.createObjectStore('products_cache', { keyPath: 'id' })
          store.createIndex('barcode', 'barcode', { unique: false })
          store.createIndex('business_id', 'business_id', { unique: false })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Add a sale to the offline queue */
export async function queueSale(sale: OfflineSale): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(sale)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get all pending sales */
export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

/** Remove a sale from the queue after successful sync */
export async function removePendingSale(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Count of pending sales */
export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

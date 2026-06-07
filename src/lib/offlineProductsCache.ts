/**
 * Offline Products Cache
 *
 * Caches products in IndexedDB so the POS can work offline.
 * Syncs from Supabase when online. Used by POS when navigator.onLine === false.
 */

const DB_NAME = 'stockia_offline'
const DB_VERSION = 2
const PRODUCTS_STORE = 'products_cache'
const SALES_STORE = 'pending_sales'

export interface CachedProduct {
  id: string
  name: string
  sale_price: number
  purchase_price: number
  avg_cost: number
  barcode: string | null
  unit: string
  stock: number
  stock_min: number
  brand: string | null
  model: string | null
  category_id: string | null
  active: boolean
  business_id: string
  updated_at: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion

      // v1 → v2: add products_cache store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(SALES_STORE)) {
          db.createObjectStore(SALES_STORE, { keyPath: 'id' })
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
          const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' })
          store.createIndex('barcode', 'barcode', { unique: false })
          store.createIndex('business_id', 'business_id', { unique: false })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Sync all products from Supabase into IndexedDB cache */
export async function syncProductsCache(products: CachedProduct[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite')
    const store = tx.objectStore(PRODUCTS_STORE)

    // Clear existing and add all fresh
    store.clear()
    for (const p of products) {
      store.put({
        ...p,
        updated_at: new Date().toISOString(),
      })
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get all cached products (for offline POS) */
export async function getCachedProducts(businessId?: string): Promise<CachedProduct[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly')
    const store = tx.objectStore(PRODUCTS_STORE)

    if (businessId) {
      const index = store.index('business_id')
      const req = index.getAll(businessId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    } else {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    }
  })
}

/** Search cached product by barcode */
export async function findCachedProductByBarcode(barcode: string): Promise<CachedProduct | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly')
    const index = tx.objectStore(PRODUCTS_STORE).index('barcode')
    const req = index.getAll(barcode)
    req.onsuccess = () => resolve(req.result?.[0] || null)
    req.onerror = () => reject(req.error)
  })
}

/** Update stock in cache after an offline sale */
export async function updateCachedStock(productId: string, soldQty: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite')
    const store = tx.objectStore(PRODUCTS_STORE)
    const req = store.get(productId)

    req.onsuccess = () => {
      const product = req.result as CachedProduct | undefined
      if (product) {
        product.stock = Math.max(0, Math.round((product.stock - soldQty) * 1000) / 1000)
        store.put(product)
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get count of cached products */
export async function getCachedProductsCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly')
    const req = tx.objectStore(PRODUCTS_STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * CajaGo — Unified Storage Layer
 * Transparently uses Tauri SQLite on Desktop (Windows) and IndexedDB on Web/PWA.
 * Desktop source of truth: local SQLite. Supabase is the synchronization target.
 */

import type { LocalCustomer, LocalProduct, LocalSalePayload, SyncOperation, SyncStatus, StockConflict } from './types'

type TauriRuntime = {
  location?: { protocol?: string; hostname?: string }
  navigator?: { userAgent?: string }
  __TAURI__?: unknown
  __TAURI_INTERNALS__?: unknown
}

/**
 * Tauri 2 inyecta __TAURI_INTERNALS__ antes que cualquier script. La ventana nativa
 * además usa el userAgent "CajaGo-Desktop" (tauri.conf.json), que sirve de respaldo si
 * la inyección llegara tarde. tauri.localhost es el origen del bundle en Windows.
 * No se usan banderas como window.isTauri: las puede poner cualquier script de la página.
 */
export function detectTauriRuntime(runtime?: TauriRuntime): boolean {
  if (!runtime) return false
  return Boolean(
    runtime.__TAURI_INTERNALS__ ||
    runtime.__TAURI__ ||
    runtime.location?.protocol === 'tauri:' ||
    runtime.location?.hostname === 'tauri.localhost' ||
    runtime.navigator?.userAgent?.includes('CajaGo-Desktop')
  )
}

let cachedTauriDetection: boolean | null = null

/** Única fuente de verdad para saber si corremos dentro de CajaGo Desktop. */
export function checkIsTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false
  // Solo se cachea el positivo: la inyección de Tauri nunca desaparece una vez presente.
  if (cachedTauriDetection) return true
  cachedTauriDetection = detectTauriRuntime(window as unknown as TauriRuntime)
  return cachedTauriDetection
}

const IDB_NAME = 'cajago_local'
const IDB_VERSION = 6

let tauriDb: any = null
let localWriteQueue: Promise<void> = Promise.resolve()

// Caché en RAM sobre la base local (SQLite / IndexedDB) para que cada lectura entre
// pantallas sea instantánea (<1ms) sin volver a consultar el disco ni parsear JSON.
const memProducts = new Map<string, LocalProduct>()
const memProductsLoadedBiz = new Set<string>()
const memCustomers = new Map<string, LocalCustomer>()
const memCustomersLoadedBiz = new Set<string>()
const memRows = new Map<string, Map<string, { id: string } & Record<string, any>>>()
const memConfig = new Map<string, string | null>()

function withLocalWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const result = localWriteQueue.then(work, work)
  localWriteQueue = result.then(() => undefined, () => undefined)
  return result
}

/**
 * Initialize SQLite database on Desktop, or IndexedDB on Web.
 */
export async function initStorage(): Promise<void> {
  if (checkIsTauriDesktop()) {
    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default
      tauriDb = await Database.load('sqlite:cajago.db')

      // Create SQLite schemas
      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          operation_id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          status TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_attempt TEXT,
          created_at TEXT NOT NULL,
          last_error TEXT
        );
      `)

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS local_products (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sale_price REAL NOT NULL,
          purchase_price REAL NOT NULL,
          avg_cost REAL NOT NULL,
          barcode TEXT,
          unit TEXT NOT NULL,
          stock REAL NOT NULL,
          stock_min REAL NOT NULL,
          brand TEXT,
          category_id TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          row_json TEXT,
          sync_token TEXT
        );
      `)

      try {
        await tauriDb.execute('ALTER TABLE local_products ADD COLUMN row_json TEXT')
      } catch {}
      try {
        await tauriDb.execute('ALTER TABLE local_products ADD COLUMN sync_token TEXT')
      } catch {}

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS local_customers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          row_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_token TEXT
        );
      `)
      try {
        await tauriDb.execute('ALTER TABLE local_customers ADD COLUMN sync_token TEXT')
      } catch {}

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS local_sales (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          customer_id TEXT,
          total REAL NOT NULL,
          receipt_type TEXT NOT NULL,
          fiscal_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          device_id TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          payload TEXT
        );
      `)

      try {
        await tauriDb.execute('ALTER TABLE local_sales ADD COLUMN payload TEXT')
      } catch {}

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS stock_conflicts (
          conflict_id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          requested_qty REAL NOT NULL,
          server_qty REAL NOT NULL,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at TEXT,
          created_at TEXT NOT NULL
        );
      `)

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS local_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `)

      // Tablas secundarias (categorías, proveedores, caja) guardadas como JSON.
      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS local_rows (
          table_name TEXT NOT NULL,
          id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          row_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_token TEXT,
          PRIMARY KEY (table_name, id)
        );
      `)
      await tauriDb.execute('CREATE INDEX IF NOT EXISTS idx_local_rows_business ON local_rows (table_name, business_id)')

      return
    } catch (err) {
      throw new Error(`No se pudo iniciar la base local de CajaGo: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Web / PWA IndexedDB init
  return new Promise((resolve, reject) => {
    openIDBWithUpgrade()
      .then((db) => {
        db.close()
        resolve()
      })
      .catch(reject)
  })
}

function ensureStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains('sync_queue')) {
    const store = db.createObjectStore('sync_queue', { keyPath: 'operation_id' })
    store.createIndex('status', 'status', { unique: false })
    store.createIndex('idempotency_key', 'idempotency_key', { unique: true })
    store.createIndex('created_at', 'created_at', { unique: false })
  }
  if (!db.objectStoreNames.contains('local_products')) {
    const store = db.createObjectStore('local_products', { keyPath: 'id' })
    store.createIndex('barcode', 'barcode', { unique: false })
    store.createIndex('business_id', 'business_id', { unique: false })
  }
  if (!db.objectStoreNames.contains('local_customers')) {
    const store = db.createObjectStore('local_customers', { keyPath: 'id' })
    store.createIndex('business_id', 'business_id', { unique: false })
  }
  if (!db.objectStoreNames.contains('local_sales')) {
    const store = db.createObjectStore('local_sales', { keyPath: 'id' })
    store.createIndex('business_id', 'business_id', { unique: false })
    store.createIndex('sync_status', 'sync_status', { unique: false })
  }
  if (!db.objectStoreNames.contains('stock_conflicts')) {
    db.createObjectStore('stock_conflicts', { keyPath: 'conflict_id' })
  }
  if (!db.objectStoreNames.contains('local_config')) {
    db.createObjectStore('local_config', { keyPath: 'key' })
  }
  if (!db.objectStoreNames.contains('local_rows')) {
    const store = db.createObjectStore('local_rows', { keyPath: ['table_name', 'id'] })
    store.createIndex('table_business', ['table_name', 'business_id'], { unique: false })
  }
}

const REQUIRED_IDB_STORES = ['sync_queue', 'local_products', 'local_customers', 'local_sales', 'stock_conflicts', 'local_config', 'local_rows']

function openIDBWithUpgrade(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      ensureStores(req.result)
    }
    req.onsuccess = () => {
      const db = req.result
      releaseOnVersionChange(db)
      // Check if all required object stores exist
      const missing = REQUIRED_IDB_STORES.filter(s => !db.objectStoreNames.contains(s))
      if (missing.length > 0) {
        db.close()
        console.warn('[IDB] Faltaban almacenes en la base web (' + missing.join(', ') + '). Recreando base limpia...')
        const delReq = indexedDB.deleteDatabase(IDB_NAME)
        delReq.onsuccess = delReq.onerror = () => {
          const retryReq = indexedDB.open(IDB_NAME, IDB_VERSION)
          retryReq.onupgradeneeded = () => ensureStores(retryReq.result)
          retryReq.onsuccess = () => {
            releaseOnVersionChange(retryReq.result)
            resolve(retryReq.result)
          }
          retryReq.onerror = () => reject(retryReq.error)
        }
        return
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('otra pestaña de CajaGo tiene abierta una versión anterior; cerrala y recargá'))
  })
}

// Una pestaña con la versión vieja no debe trabar la actualización de la base en otra.
function releaseOnVersionChange(db: IDBDatabase) {
  db.onversionchange = () => db.close()
}

function getIDB(): Promise<IDBDatabase> {
  return openIDBWithUpgrade()
}

// ──────────────────────────────────────────────
// PRODUCTS REPOSITORY
// ──────────────────────────────────────────────

export async function saveLocalProducts(products: LocalProduct[], businessId?: string): Promise<void> {
  const targetBusinessId = businessId || products[0]?.business_id
  if (targetBusinessId) {
    for (const [id, p] of memProducts) {
      if (p.business_id === targetBusinessId) memProducts.delete(id)
    }
    memProductsLoadedBiz.add(targetBusinessId)
  }
  for (const p of products) {
    memProducts.set(p.id, { ...p })
  }

  if (tauriDb) {
    return withLocalWriteLock(async () => {
      const syncToken = crypto.randomUUID()
      const chunkSize = 50 // 50 * 16 = 800 parámetros (< 999 límite SQLite)
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize)
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        const values: any[] = []
        for (const p of chunk) {
          values.push(
            p.id,
            p.business_id,
            p.name,
            Number(p.sale_price) || 0,
            Number(p.purchase_price) || 0,
            Number(p.avg_cost) || 0,
            p.barcode || null,
            p.unit || 'u',
            Number(p.stock) || 0,
            Number(p.stock_min) || 0,
            p.brand || null,
            p.category_id || null,
            p.active === false ? 0 : 1,
            p.updated_at || new Date().toISOString(),
            JSON.stringify(p),
            syncToken
          )
        }
        await tauriDb.execute(
          `INSERT OR REPLACE INTO local_products
           (id, business_id, name, sale_price, purchase_price, avg_cost, barcode, unit, stock, stock_min, brand, category_id, active, updated_at, row_json, sync_token)
           VALUES ${placeholders}`,
          values
        )
      }
      if (targetBusinessId) {
        await tauriDb.execute(
          'DELETE FROM local_products WHERE business_id = ? AND (sync_token IS NULL OR sync_token <> ?)',
          [targetBusinessId, syncToken]
        )
      }
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_products', 'readwrite')
    const store = tx.objectStore('local_products')
    if (targetBusinessId) {
      const request = store.index('business_id').openKeyCursor(IDBKeyRange.only(targetBusinessId))
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        }
      }
    }
    for (const p of products) {
      store.put(p)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLocalProducts(businessId?: string): Promise<LocalProduct[]> {
  if (businessId && memProductsLoadedBiz.has(businessId)) {
    const cached: LocalProduct[] = []
    for (const p of memProducts.values()) {
      if (p.business_id === businessId && p.active !== false) cached.push({ ...p })
    }
    return cached
  }

  if (tauriDb) {
    if (businessId) {
      const rows = await tauriDb.select(
        'SELECT * FROM local_products WHERE business_id = ? AND active = 1',
        [businessId]
      )
      const mapped = rows.map(mapSqliteProduct)
      for (const p of mapped) memProducts.set(p.id, { ...p })
      memProductsLoadedBiz.add(businessId)
      return mapped
    }
    const rows = await tauriDb.select('SELECT * FROM local_products WHERE active = 1')
    return rows.map(mapSqliteProduct)
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_products', 'readonly')
    const store = tx.objectStore('local_products')
    if (businessId) {
      const index = store.index('business_id')
      const req = index.getAll(businessId)
      req.onsuccess = () => {
        const active = (req.result || []).filter((p: LocalProduct) => p.active !== false)
        for (const p of active) memProducts.set(p.id, { ...p })
        memProductsLoadedBiz.add(businessId)
        resolve(active)
      }
      req.onerror = () => reject(req.error)
    } else {
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result || []).filter((p: LocalProduct) => p.active !== false))
      req.onerror = () => reject(req.error)
    }
  })
}

export async function findLocalProductByBarcode(barcode: string): Promise<LocalProduct | null> {
  if (!barcode) return null
  const cleaned = barcode.trim()

  for (const p of memProducts.values()) {
    if (p.barcode === cleaned && p.active !== false) return { ...p }
  }

  if (tauriDb) {
    const rows = await tauriDb.select(
      'SELECT * FROM local_products WHERE barcode = ? AND active = 1 LIMIT 1',
      [cleaned]
    )
    if (rows && rows.length > 0) {
      const mapped = mapSqliteProduct(rows[0])
      memProducts.set(mapped.id, { ...mapped })
      return mapped
    }
    return null
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_products', 'readonly')
    const store = tx.objectStore('local_products')
    const index = store.index('barcode')
    const req = index.get(cleaned)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

function mapSqliteProduct(row: any): LocalProduct {
  const stored = row.row_json ? JSON.parse(row.row_json) : {}
  const { row_json: _rowJson, sync_token: _syncToken, ...columns } = row
  return { ...stored, ...columns, active: Boolean(row.active) }
}

function sqliteWriteProduct(p: LocalProduct, syncToken: string) {
  return tauriDb.execute(
    `INSERT OR REPLACE INTO local_products
     (id, business_id, name, sale_price, purchase_price, avg_cost, barcode, unit, stock, stock_min, brand, category_id, active, updated_at, row_json, sync_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.business_id,
      p.name,
      Number(p.sale_price) || 0,
      Number(p.purchase_price) || 0,
      Number(p.avg_cost) || 0,
      p.barcode || null,
      p.unit || 'u',
      Number(p.stock) || 0,
      Number(p.stock_min) || 0,
      p.brand || null,
      p.category_id || null,
      p.active === false ? 0 : 1,
      p.updated_at || new Date().toISOString(),
      JSON.stringify(p),
      syncToken,
    ]
  )
}

async function getLocalProductById(productId: string): Promise<LocalProduct | null> {
  const fromMem = memProducts.get(productId)
  if (fromMem) return { ...fromMem }

  if (tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM local_products WHERE id = ? LIMIT 1', [productId])
    return rows?.length ? mapSqliteProduct(rows[0]) : null
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('local_products', 'readonly').objectStore('local_products').get(productId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/** Alta o modificación local de un producto (la sincronización va aparte, por la cola). */
export async function patchLocalProduct(
  productId: string,
  patch: Partial<LocalProduct>,
  businessId?: string
): Promise<void> {
  const current = await getLocalProductById(productId)
  if (!current && !businessId) return
  const next = {
    ...(current || { id: productId, business_id: businessId, active: true, stock: 0, stock_min: 0 }),
    ...patch,
    updated_at: new Date().toISOString(),
  } as LocalProduct

  memProducts.set(productId, { ...next })

  if (tauriDb) {
    return withLocalWriteLock(() => sqliteWriteProduct(next, 'local'))
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_products', 'readwrite')
    tx.objectStore('local_products').put(next)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveLocalCustomers(customers: LocalCustomer[], businessId?: string): Promise<void> {
  const targetBusinessId = businessId || customers[0]?.business_id
  if (targetBusinessId) {
    for (const [id, c] of memCustomers) {
      if (c.business_id === targetBusinessId) memCustomers.delete(id)
    }
    memCustomersLoadedBiz.add(targetBusinessId)
  }
  for (const customer of customers) {
    memCustomers.set(customer.id, { ...customer })
  }

  if (tauriDb) {
    return withLocalWriteLock(async () => {
      const syncToken = crypto.randomUUID()
      const now = new Date().toISOString()
      const chunkSize = 100 // 100 * 6 = 600 parámetros
      for (let i = 0; i < customers.length; i += chunkSize) {
        const chunk = customers.slice(i, i + chunkSize)
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
        const values: any[] = []
        for (const customer of chunk) {
          values.push(customer.id, customer.business_id, customer.name, JSON.stringify(customer), now, syncToken)
        }
        await tauriDb.execute(
          `INSERT OR REPLACE INTO local_customers (id, business_id, name, row_json, updated_at, sync_token)
           VALUES ${placeholders}`,
          values
        )
      }
      if (targetBusinessId) {
        await tauriDb.execute(
          'DELETE FROM local_customers WHERE business_id = ? AND (sync_token IS NULL OR sync_token <> ?)',
          [targetBusinessId, syncToken]
        )
      }
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_customers', 'readwrite')
    const store = tx.objectStore('local_customers')
    if (targetBusinessId) {
      const request = store.index('business_id').openKeyCursor(IDBKeyRange.only(targetBusinessId))
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        }
      }
    }
    for (const customer of customers) store.put(customer)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLocalCustomers(businessId: string): Promise<LocalCustomer[]> {
  if (businessId && memCustomersLoadedBiz.has(businessId)) {
    const cached: LocalCustomer[] = []
    for (const c of memCustomers.values()) {
      if (c.business_id === businessId) cached.push({ ...c })
    }
    return cached.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }

  if (tauriDb) {
    const rows = await tauriDb.select(
      'SELECT row_json FROM local_customers WHERE business_id = ? ORDER BY name',
      [businessId]
    )
    const mapped: LocalCustomer[] = rows.map((row: any) => JSON.parse(row.row_json))
    for (const c of mapped) memCustomers.set(c.id, { ...c })
    memCustomersLoadedBiz.add(businessId)
    return mapped
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_customers', 'readonly')
    const request = tx.objectStore('local_customers').index('business_id').getAll(businessId)
    request.onsuccess = () => {
      const list = (request.result || []).sort((a: LocalCustomer, b: LocalCustomer) => (a.name || '').localeCompare(b.name || ''))
      for (const c of list) memCustomers.set(c.id, { ...c })
      memCustomersLoadedBiz.add(businessId)
      resolve(list)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function upsertLocalCustomer(customer: LocalCustomer): Promise<void> {
  memCustomers.set(customer.id, { ...customer })
  if (tauriDb) {
    return withLocalWriteLock(async () => {
      await tauriDb.execute(
        `INSERT OR REPLACE INTO local_customers (id, business_id, name, row_json, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customer.id, customer.business_id, customer.name, JSON.stringify(customer), new Date().toISOString(), 'local']
      )
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_customers', 'readwrite')
    tx.objectStore('local_customers').put(customer)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function patchLocalCustomer(
  customerId: string,
  patch: Partial<LocalCustomer>,
  businessId?: string
): Promise<void> {
  let current: LocalCustomer | null = memCustomers.get(customerId) || null
  if (!current) {
    if (tauriDb) {
      const rows = await tauriDb.select('SELECT row_json FROM local_customers WHERE id = ? LIMIT 1', [customerId])
      current = rows?.length ? JSON.parse(rows[0].row_json) : null
    } else {
      const db = await getIDB()
      current = await new Promise((resolve, reject) => {
        const req = db.transaction('local_customers', 'readonly').objectStore('local_customers').get(customerId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    }
  }
  if (!current && !businessId) return
  await upsertLocalCustomer({ ...(current || { id: customerId, business_id: businessId, balance: 0 }), ...patch } as LocalCustomer)
}

export async function deleteLocalCustomer(customerId: string): Promise<void> {
  memCustomers.delete(customerId)
  if (tauriDb) {
    return withLocalWriteLock(async () => {
      await tauriDb.execute('DELETE FROM local_customers WHERE id = ?', [customerId])
    })
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_customers', 'readwrite')
    tx.objectStore('local_customers').delete(customerId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveLocalSale(payload: LocalSalePayload, syncStatus: SyncStatus): Promise<void> {
  const sale = payload.sale
  if (tauriDb) {
    await tauriDb.execute(
      `INSERT OR REPLACE INTO local_sales
       (id, business_id, customer_id, total, receipt_type, fiscal_status, created_at, device_id, sync_status, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sale.id, sale.business_id, sale.customer_id || null, sale.total, sale.receipt_type,
        sale.fiscal_status, sale.created_at, sale.device_id, syncStatus, JSON.stringify(payload)]
    )
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_sales', 'readwrite')
    tx.objectStore('local_sales').put({ ...sale, sync_status: syncStatus, payload })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function updateLocalSaleStatus(saleId: string, status: SyncStatus): Promise<void> {
  if (tauriDb) {
    await tauriDb.execute('UPDATE local_sales SET sync_status = ? WHERE id = ?', [status, saleId])
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_sales', 'readwrite')
    const store = tx.objectStore('local_sales')
    const request = store.get(saleId)
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, sync_status: status })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function decrementLocalStock(productId: string, quantity: number): Promise<void> {
  return adjustLocalStock(productId, -quantity)
}

/** Suma (o resta, con delta negativo) stock local sin bajar de cero. */
export async function adjustLocalStock(productId: string, delta: number): Promise<void> {
  const inMem = memProducts.get(productId)
  if (inMem) {
    inMem.stock = Math.max(0, Math.round(((Number(inMem.stock) || 0) + delta) * 1000) / 1000)
    inMem.updated_at = new Date().toISOString()
  }

  if (tauriDb) {
    return withLocalWriteLock(async () => {
      await tauriDb.execute(
        'UPDATE local_products SET stock = MAX(0, ROUND(stock + ?, 3)) WHERE id = ?',
        [delta, productId]
      )
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_products', 'readwrite')
    const store = tx.objectStore('local_products')
    const req = store.get(productId)
    req.onsuccess = () => {
      const prod = req.result
      if (prod) {
        prod.stock = Math.max(0, Math.round(((prod.stock || 0) + delta) * 1000) / 1000)
        prod.updated_at = new Date().toISOString()
        store.put(prod)
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// ──────────────────────────────────────────────
// SYNC QUEUE REPOSITORY
// ──────────────────────────────────────────────

export async function queueSyncOperation(op: SyncOperation): Promise<void> {
  if (tauriDb) {
    await tauriDb.execute(
      `INSERT OR REPLACE INTO sync_queue 
       (operation_id, operation_type, payload, idempotency_key, device_id, status, retry_count, last_attempt, created_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        op.operation_id,
        op.operation_type,
        JSON.stringify(op.payload),
        op.idempotency_key,
        op.device_id,
        op.status,
        op.retry_count,
        op.last_attempt,
        op.created_at,
        op.last_error || null,
      ]
    )
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite')
    tx.objectStore('sync_queue').put(op)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingOperations(): Promise<SyncOperation[]> {
  if (tauriDb) {
    const rows = await tauriDb.select(
      `SELECT * FROM sync_queue 
       WHERE status IN ('pending', 'syncing', 'failed')
       ORDER BY created_at ASC`
    )
    return rows.map((r: any) => ({
      ...r,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    }))
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly')
    const store = tx.objectStore('sync_queue')
    const req = store.getAll()
    req.onsuccess = () => {
      const all: SyncOperation[] = req.result || []
      const pending = all
        // 'syncing' se incluye: si la app se cerró a mitad de un envío, la operación se retoma.
        .filter((o) => o.status === 'pending' || o.status === 'syncing' || o.status === 'failed')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      resolve(pending)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function updateOperationStatus(
  operationId: string,
  status: SyncStatus,
  lastError?: string | null
): Promise<void> {
  const now = new Date().toISOString()

  if (tauriDb) {
    await tauriDb.execute(
      `UPDATE sync_queue 
       SET status = ?, 
           last_attempt = ?, 
           last_error = ?,
           retry_count = CASE WHEN ? = 'failed' THEN retry_count + 1 ELSE retry_count END
       WHERE operation_id = ?`,
      [status, now, lastError || null, status, operationId]
    )
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite')
    const store = tx.objectStore('sync_queue')
    const req = store.get(operationId)
    req.onsuccess = () => {
      const op: SyncOperation = req.result
      if (op) {
        op.status = status
        op.last_attempt = now
        if (lastError !== undefined) op.last_error = lastError
        if (status === 'failed') op.retry_count = (op.retry_count || 0) + 1
        store.put(op)
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function removeOperation(operationId: string): Promise<void> {
  if (tauriDb) {
    await tauriDb.execute('DELETE FROM sync_queue WHERE operation_id = ?', [operationId])
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite')
    tx.objectStore('sync_queue').delete(operationId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ──────────────────────────────────────────────
// GENERIC LOCAL ROWS (categorías, proveedores, caja)
// ──────────────────────────────────────────────

type LocalRow = { id: string } & Record<string, any>

/** Reemplaza el snapshot local de una tabla de un negocio con lo que vino del servidor. */
export async function saveLocalRows(table: string, businessId: string, rows: LocalRow[]): Promise<void> {
  const memKey = `${table}:${businessId}`
  const bucket = new Map<string, LocalRow>()
  for (const row of rows) bucket.set(row.id, { ...row })
  memRows.set(memKey, bucket)

  const now = new Date().toISOString()
  if (tauriDb) {
    return withLocalWriteLock(async () => {
      const syncToken = crypto.randomUUID()
      const chunkSize = 100 // 100 * 6 = 600 parámetros
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
        const values: any[] = []
        for (const row of chunk) {
          values.push(table, row.id, businessId, JSON.stringify(row), now, syncToken)
        }
        await tauriDb.execute(
          `INSERT OR REPLACE INTO local_rows (table_name, id, business_id, row_json, updated_at, sync_token)
           VALUES ${placeholders}`,
          values
        )
      }
      await tauriDb.execute(
        'DELETE FROM local_rows WHERE table_name = ? AND business_id = ? AND (sync_token IS NULL OR sync_token <> ?)',
        [table, businessId, syncToken]
      )
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_rows', 'readwrite')
    const store = tx.objectStore('local_rows')
    const request = store.index('table_business').openKeyCursor(IDBKeyRange.only([table, businessId]))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        store.delete(cursor.primaryKey)
        cursor.continue()
      } else {
        for (const row of rows) store.put({ table_name: table, id: row.id, business_id: businessId, row, updated_at: now })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLocalRows<T = LocalRow>(table: string, businessId: string): Promise<T[]> {
  const memKey = `${table}:${businessId}`
  const inMem = memRows.get(memKey)
  if (inMem) {
    return [...inMem.values()].map((r) => ({ ...r }) as unknown as T)
  }

  if (tauriDb) {
    const rows = await tauriDb.select(
      'SELECT row_json FROM local_rows WHERE table_name = ? AND business_id = ?',
      [table, businessId]
    )
    const parsed: LocalRow[] = rows.map((row: any) => JSON.parse(row.row_json))
    const bucket = new Map<string, LocalRow>()
    for (const r of parsed) bucket.set(r.id, { ...r })
    memRows.set(memKey, bucket)
    return parsed as unknown as T[]
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('local_rows', 'readonly').objectStore('local_rows')
      .index('table_business').getAll([table, businessId])
    req.onsuccess = () => {
      const parsed: LocalRow[] = (req.result || []).map((entry: any) => entry.row)
      const bucket = new Map<string, LocalRow>()
      for (const r of parsed) bucket.set(r.id, { ...r })
      memRows.set(memKey, bucket)
      resolve(parsed as unknown as T[])
    }
    req.onerror = () => reject(req.error)
  })
}

/** Inserta o fusiona (merge) una fila local. */
export async function upsertLocalRow(table: string, businessId: string, row: LocalRow): Promise<void> {
  const memKey = `${table}:${businessId}`
  const bucket = memRows.get(memKey)
  if (bucket) {
    const prev = bucket.get(row.id)
    bucket.set(row.id, prev ? { ...prev, ...row } : { ...row })
  }

  const now = new Date().toISOString()
  if (tauriDb) {
    return withLocalWriteLock(async () => {
      const existing = await tauriDb.select(
        'SELECT row_json FROM local_rows WHERE table_name = ? AND id = ? LIMIT 1',
        [table, row.id]
      )
      const merged = existing?.length ? { ...JSON.parse(existing[0].row_json), ...row } : row
      await tauriDb.execute(
        `INSERT OR REPLACE INTO local_rows (table_name, id, business_id, row_json, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, 'local')`,
        [table, row.id, businessId, JSON.stringify(merged), now]
      )
    })
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_rows', 'readwrite')
    const store = tx.objectStore('local_rows')
    const req = store.get([table, row.id])
    req.onsuccess = () => {
      const merged = req.result ? { ...req.result.row, ...row } : row
      store.put({ table_name: table, id: row.id, business_id: businessId, row: merged, updated_at: now })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteLocalRow(table: string, id: string): Promise<void> {
  for (const [key, bucket] of memRows) {
    if (key.startsWith(`${table}:`)) bucket.delete(id)
  }

  if (tauriDb) {
    return withLocalWriteLock(async () => {
      await tauriDb.execute('DELETE FROM local_rows WHERE table_name = ? AND id = ?', [table, id])
    })
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_rows', 'readwrite')
    tx.objectStore('local_rows').delete([table, id])
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ──────────────────────────────────────────────
// CONFLICTS & CONFIG REPOSITORY
// ──────────────────────────────────────────────

export async function getStockConflicts(): Promise<StockConflict[]> {
  if (tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM stock_conflicts WHERE resolved = 0 ORDER BY created_at DESC')
    return rows.map((row: any) => ({ ...row, resolved: Boolean(row.resolved) }))
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('stock_conflicts', 'readonly').objectStore('stock_conflicts').getAll()
    req.onsuccess = () => resolve((req.result || []).filter((conflict: StockConflict) => !conflict.resolved))
    req.onerror = () => reject(req.error)
  })
}

export async function resolveStockConflict(conflictId: string): Promise<void> {
  const resolvedAt = new Date().toISOString()
  if (tauriDb) {
    await tauriDb.execute(
      'UPDATE stock_conflicts SET resolved = 1, resolved_at = ? WHERE conflict_id = ?',
      [resolvedAt, conflictId]
    )
    return
  }
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_conflicts', 'readwrite')
    const store = tx.objectStore('stock_conflicts')
    const req = store.get(conflictId)
    req.onsuccess = () => {
      if (req.result) store.put({ ...req.result, resolved: true, resolved_at: resolvedAt })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function recordStockConflict(conflict: StockConflict): Promise<void> {
  if (tauriDb) {
    await tauriDb.execute(
      `INSERT OR REPLACE INTO stock_conflicts 
       (conflict_id, sale_id, product_id, product_name, requested_qty, server_qty, resolved, resolved_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conflict.conflict_id,
        conflict.sale_id,
        conflict.product_id,
        conflict.product_name,
        conflict.requested_qty,
        conflict.server_qty,
        conflict.resolved ? 1 : 0,
        conflict.resolved_at || null,
        conflict.created_at,
      ]
    )
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_conflicts', 'readwrite')
    tx.objectStore('stock_conflicts').put(conflict)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLocalConfig(key: string): Promise<string | null> {
  if (memConfig.has(key)) {
    return memConfig.get(key) ?? null
  }

  if (tauriDb) {
    const rows = await tauriDb.select('SELECT value FROM local_config WHERE key = ? LIMIT 1', [key])
    const val = rows && rows.length > 0 ? rows[0].value : null
    memConfig.set(key, val)
    return val
  }

  const db = await getIDB()
  return new Promise((resolve) => {
    const tx = db.transaction('local_config', 'readonly')
    const req = tx.objectStore('local_config').get(key)
    req.onsuccess = () => {
      const val = req.result ? req.result.value : null
      memConfig.set(key, val)
      resolve(val)
    }
    req.onerror = () => resolve(null)
  })
}

export async function setLocalConfig(key: string, value: string): Promise<void> {
  memConfig.set(key, value)
  if (tauriDb) {
    await tauriDb.execute(
      'INSERT OR REPLACE INTO local_config (key, value) VALUES (?, ?)',
      [key, value]
    )
    return
  }

  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local_config', 'readwrite')
    tx.objectStore('local_config').put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

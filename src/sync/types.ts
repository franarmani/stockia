/**
 * CajaGo — Unified Sync & Offline Types
 * Used by both Web (IndexedDB) and Desktop (Tauri SQLite).
 */

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export type SyncOperationType =
  | 'CREATE_SALE'
  | 'UPDATE_STOCK'
  | 'CUSTOMER_PAYMENT'
  | 'UPSERT_ROW'
  | 'UPDATE_ROW'
  | 'DELETE_ROW'
  | 'RPC_CALL'

/** Tablas que se pueden escribir offline mediante operaciones genéricas de fila. */
export type SyncTable =
  | 'products'
  | 'customers'
  | 'categories'
  | 'suppliers'
  | 'cash_sessions'
  | 'cash_movements'
  | 'purchase_concepts'
  | 'accounting_accounts'
  | 'promotions'
  | 'loyalty_rewards'
  | 'loyalty_movements'
  | 'warehouses'
  | 'warehouse_stock'

/**
 * Llamada a una función del servidor (compras, pagos, asientos) guardada para enviar después.
 * Esas funciones no son idempotentes, así que si un intento anterior pudo haber llegado al
 * servidor (attempted_at), antes de reintentar se busca el registro que habría creado (dedupe).
 */
export interface RpcOperationPayload {
  business_id: string
  rpc: string
  args: Record<string, any>
  /** Texto para mostrar en el panel de sincronización. */
  label: string
  /** Datos locales que esta operación modifica (no se pisan con descargas mientras esté pendiente). */
  tables: string[]
  dedupe?: { table: string; match: Record<string, string | number | boolean | null> }
  /** Error del servidor que significa "ya estaba hecho" (se toma como éxito). */
  duplicate_error?: string
  attempted_at?: string | null
  /** Datos para mostrar la operación pendiente en los listados mientras no se sincroniza. */
  preview?: Record<string, any>
}

export interface RowOperationPayload {
  table: SyncTable
  business_id: string
  id: string
  /** UPDATE_ROW masivo: mismo cambio aplicado a varias filas (id queda como referencia). */
  ids?: string[]
  /** UPSERT_ROW: fila completa a insertar. UPDATE_ROW: solo los campos cambiados. */
  values?: Record<string, any>
}

/** Movimiento de stock expresado como delta: dos cajas que venden offline suman bien al sincronizar. */
export interface StockMovementPayload {
  business_id: string
  movement: {
    id: string
    product_id: string
    type: 'sale' | 'purchase' | 'adjustment'
    quantity: number
    notes?: string | null
  }
}

export interface CustomerPaymentPayload {
  business_id: string
  user_id: string
  payment: {
    id: string
    customer_id: string
    amount: number
    notes: string
  }
}

export interface SyncOperation {
  operation_id: string // UUID
  operation_type: SyncOperationType
  payload: Record<string, any>
  idempotency_key: string // UUID unique
  device_id: string // Workstation UUID
  status: SyncStatus
  retry_count: number
  last_attempt: string | null // ISO Date
  created_at: string // ISO Date
  last_error?: string | null
}

export interface LocalProduct {
  id: string
  business_id: string
  name: string
  sale_price: number
  purchase_price: number
  avg_cost: number
  barcode: string | null
  unit: string
  stock: number
  stock_min: number
  brand: string | null
  category_id: string | null
  description?: string | null
  image_url?: string | null
  size_label?: string | null
  model?: string | null
  presentation?: string | null
  supplier_id?: string | null
  material?: string | null
  active: boolean
  created_at?: string
  updated_at: string
}

export interface LocalCustomer {
  id: string
  business_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  doc_tipo: string
  doc_nro: string | null
  iva_condition: string
  balance: number
  created_at: string
}

export interface LocalSalePayload {
  customerToCreate?: LocalCustomer
  sale: {
    id: string
    business_id: string
    customer_id?: string | null
    total: number
    discount?: number
    payment_method: string
    seller_id: string
    receipt_type: 'ticket'
    installments?: number
    surcharge_pct?: number
    note?: string | null
    fiscal_status: 'approved' | 'pending' | 'rejected'
    device_id: string
    created_at: string
  }
  items: Array<{
    id: string
    sale_id: string
    product_id: string
    quantity: number
    price: number
    cost_at_sale: number
  }>
  payments: Array<{
    id: string
    sale_id: string
    payment_method: string
    amount: number
  }>
  stockUpdates: Array<{
    productId: string
    newStock: number
    qty: number
    movementId: string
  }>
  accountUpdate?: {
    customerId: string
    amount: number
  } | null
}

export interface StockConflict {
  conflict_id: string
  sale_id: string
  product_id: string
  product_name: string
  requested_qty: number
  server_qty: number
  resolved: boolean
  resolved_at?: string | null
  created_at: string
}

export interface SyncStats {
  pendingCount: number
  failedCount: number
  conflictCount: number
  /** Hay conexión pero no sesión de Supabase (se ingresó offline): falta reingresar la contraseña. */
  needsLogin: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  online: boolean
  isTauriDesktop: boolean
}

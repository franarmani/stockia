/**
 * CajaGo — Master Idempotent Sync Engine
 * Local-first: toda escritura se guarda primero en la base local (SQLite en Desktop,
 * IndexedDB en Web) junto con una operación en la cola. La cola se envía a Supabase
 * cuando hay conexión real, en orden, con reintentos con backoff e idempotencia.
 */

import { supabase } from '@/lib/supabase'
import { fetchAllProductsInBatches } from '@/lib/productService'
import {
  initStorage,
  getPendingOperations,
  updateOperationStatus,
  removeOperation,
  queueSyncOperation,
  saveLocalProducts,
  getLocalProducts,
  saveLocalCustomers,
  getLocalCustomers,
  upsertLocalCustomer,
  patchLocalCustomer,
  deleteLocalCustomer,
  patchLocalProduct,
  adjustLocalStock,
  saveLocalSale,
  updateLocalSaleStatus,
  decrementLocalStock,
  recordStockConflict,
  getStockConflicts,
  resolveStockConflict,
  saveLocalRows,
  getLocalRows,
  upsertLocalRow,
  deleteLocalRow,
  getLocalConfig,
  setLocalConfig,
  checkIsTauriDesktop,
} from './storage'
import {
  isOnline,
  isNetworkError,
  onConnectivityChange,
  reportNetworkFailure,
} from './connectivity'
import { migrateLegacyOfflineSales } from './legacyMigration'
import { getDeviceId } from '../desktop/device'
import type {
  SyncOperation,
  SyncOperationType,
  LocalSalePayload,
  SyncStats,
  LocalProduct,
  LocalCustomer,
  StockConflict,
  SyncTable,
  RowOperationPayload,
  StockMovementPayload,
  CustomerPaymentPayload,
  RpcOperationPayload,
} from './types'

type SyncListener = (stats: SyncStats) => void

const MAX_AUTO_RETRIES = 10

/** Negocio al que pertenece una operación (para no pisar datos locales con un pull). */
export function operationBusinessId(op: SyncOperation): string | undefined {
  if (op.operation_type === 'CREATE_SALE') return (op.payload as LocalSalePayload).sale?.business_id
  return (op.payload as { business_id?: string }).business_id
}

/** Tablas locales que una operación pendiente modifica. */
export function operationTables(op: SyncOperation): string[] {
  switch (op.operation_type) {
    case 'CREATE_SALE': return ['products', 'customers']
    case 'UPDATE_STOCK': return ['products']
    case 'CUSTOMER_PAYMENT': return ['customers']
    case 'RPC_CALL': return (op.payload as RpcOperationPayload).tables
    default: {
      const table = (op.payload as RowOperationPayload).table
      // Un movimiento de puntos cambia el saldo del cliente.
      return table === 'loyalty_movements' ? [table, 'customers'] : [table]
    }
  }
}

const APPEND_ONLY_TABLES = new Set<string>(['loyalty_movements'])

/** Margen por diferencias de reloj entre la PC y el servidor al buscar un posible duplicado. */
const DEDUPE_CLOCK_MARGIN_MS = 15 * 60 * 1000

export function backoffDelayMs(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 60000)
}

class SyncEngine {
  private isProcessing = false
  private listeners: Set<SyncListener> = new Set()
  private syncedListeners: Set<() => void> = new Set()
  private lastSyncAt: string | null = null
  private needsLogin = false
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  public async hasPendingWrites(businessId: string, table: string): Promise<boolean> {
    return (await getPendingOperations()).some((op) =>
      operationBusinessId(op) === businessId && operationTables(op).includes(table)
    )
  }

  public async init() {
    if (this.initialized) return
    if (this.initializationPromise) return this.initializationPromise
    this.initializationPromise = this.initialize()
    try {
      await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  private async initialize() {
    await initStorage()
    this.initialized = true

    try {
      const migrated = await migrateLegacyOfflineSales(async (payload, legacyId) => {
        const markerKey = `legacy_sale_migrated:${legacyId}`
        if (await getLocalConfig(markerKey)) return
        await this.queueOfflineSale(payload)
        await setLocalConfig(markerKey, payload.sale.id)
      })
      if (migrated > 0) console.info(`[CajaGo Sync] ${migrated} venta(s) de la cola anterior migradas`)
    } catch (error) {
      console.warn('[CajaGo Sync] No se pudo migrar la cola offline anterior:', error)
    }

    if (typeof window !== 'undefined') {
      onConnectivityChange((online) => {
        this.notifyListeners()
        if (online) this.processQueue()
      })

      // Heartbeat: reintenta lo pendiente cada 30 segundos si hay conexión
      setInterval(() => {
        if (isOnline() && !this.isProcessing) this.processQueue()
      }, 30000)
    }

    if (isOnline()) {
      await this.processQueue()
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    this.getStats().then((stats) => listener(stats))
    return () => this.listeners.delete(listener)
  }

  /** Se dispara cada vez que la cola envió operaciones al servidor (para refrescar pantallas). */
  public onSynced(listener: () => void): () => void {
    this.syncedListeners.add(listener)
    return () => this.syncedListeners.delete(listener)
  }

  private async notifyListeners() {
    const stats = await this.getStats()
    this.listeners.forEach((fn) => fn(stats))
  }

  public async getStats(): Promise<SyncStats> {
    const base = {
      needsLogin: this.needsLogin,
      isSyncing: this.isProcessing,
      lastSyncAt: this.lastSyncAt,
      online: isOnline(),
      isTauriDesktop: checkIsTauriDesktop(),
    }
    try {
      const pendingOps = await getPendingOperations()
      const conflicts = await getStockConflicts()
      return {
        ...base,
        pendingCount: pendingOps.filter((o) => o.status !== 'failed').length,
        failedCount: pendingOps.filter((o) => o.status === 'failed').length,
        conflictCount: conflicts.length,
      }
    } catch {
      return { ...base, pendingCount: 0, failedCount: 0, conflictCount: 0, needsLogin: this.needsLogin }
    }
  }

  public async getFailedOperations(): Promise<SyncOperation[]> {
    await this.init()
    return (await getPendingOperations()).filter((op) => op.status === 'failed')
  }

  /**
   * Descarta una operación que el servidor rechaza siempre (ej. borrar un cliente con ventas).
   * Las ventas no se pueden descartar: son dinero cobrado y deben llegar al servidor.
   */
  public async discardOperation(operationId: string): Promise<void> {
    const op = (await getPendingOperations()).find((item) => item.operation_id === operationId)
    if (!op) return
    if (op.operation_type === 'CREATE_SALE') throw new Error('Las ventas no se pueden descartar')
    await removeOperation(operationId)
    await this.notifyListeners()
    this.syncedListeners.forEach((fn) => fn())
  }

  public getStockConflicts(): Promise<StockConflict[]> {
    return getStockConflicts()
  }

  public async resolveStockConflict(conflictId: string): Promise<void> {
    await resolveStockConflict(conflictId)
    await this.notifyListeners()
  }

  // ──────────────────────────────────────────────
  // ESCRITURAS LOCAL-FIRST
  // ──────────────────────────────────────────────

  private async enqueue(type: SyncOperationType, payload: Record<string, any>): Promise<SyncOperation> {
    await this.init()
    const deviceId = await getDeviceId()
    const idempotencyKey = crypto.randomUUID()
    const op: SyncOperation = {
      operation_id: crypto.randomUUID(),
      operation_type: type,
      payload,
      idempotency_key: idempotencyKey,
      device_id: deviceId,
      status: 'pending',
      retry_count: 0,
      last_attempt: null,
      created_at: new Date().toISOString(),
      last_error: null,
    }
    await queueSyncOperation(op)
    return op
  }

  private afterLocalWrite() {
    this.notifyListeners()
    if (isOnline()) this.processQueue()
  }

  /** Alta de una fila: se ve al instante en la base local y se envía a Supabase en segundo plano. */
  public async createRow(table: SyncTable, businessId: string, row: { id: string } & Record<string, any>) {
    const values = { ...row, business_id: table === 'cash_movements' ? undefined : businessId }
    if (values.business_id === undefined) delete values.business_id
    await this.applyLocalRow(table, businessId, row.id, values)
    await this.enqueue('UPSERT_ROW', { table, business_id: businessId, id: row.id, values } satisfies RowOperationPayload)
    this.afterLocalWrite()
  }

  public async updateRow(table: SyncTable, businessId: string, id: string, patch: Record<string, any>) {
    await this.applyLocalRow(table, businessId, id, patch)
    await this.enqueue('UPDATE_ROW', { table, business_id: businessId, id, values: patch } satisfies RowOperationPayload)
    this.afterLocalWrite()
  }

  /** El mismo cambio sobre muchas filas, en una sola operación de la cola. */
  public async updateRows(table: SyncTable, businessId: string, ids: string[], patch: Record<string, any>) {
    if (ids.length === 0) return
    for (const id of ids) await this.applyLocalRow(table, businessId, id, patch)
    await this.enqueue('UPDATE_ROW', { table, business_id: businessId, id: ids[0], ids, values: patch } satisfies RowOperationPayload)
    this.afterLocalWrite()
  }

  public async deleteRow(table: SyncTable, businessId: string, id: string) {
    if (table === 'customers') await deleteLocalCustomer(id)
    else if (table === 'products') await patchLocalProduct(id, { active: false })
    else await deleteLocalRow(table, id)
    await this.enqueue('DELETE_ROW', { table, business_id: businessId, id } satisfies RowOperationPayload)
    this.afterLocalWrite()
  }

  private async applyLocalRow(table: SyncTable, businessId: string, id: string, values: Record<string, any>) {
    if (table === 'products') return patchLocalProduct(id, values as Partial<LocalProduct>, businessId)
    if (table === 'customers') return patchLocalCustomer(id, values as Partial<LocalCustomer>, businessId)
    return upsertLocalRow(table, businessId, { ...values, id })
  }

  /** Ajuste de stock como delta (+ ingreso / − egreso). Dos cajas offline suman bien al sincronizar. */
  public async adjustStock(
    businessId: string,
    productId: string,
    delta: number,
    type: StockMovementPayload['movement']['type'],
    notes?: string | null
  ) {
    await adjustLocalStock(productId, delta)
    await this.enqueue('UPDATE_STOCK', {
      business_id: businessId,
      movement: { id: crypto.randomUUID(), product_id: productId, type, quantity: delta, notes: notes || null },
    } satisfies StockMovementPayload)
    this.afterLocalWrite()
  }

  /** Suma o resta puntos del club: se ve al instante en el cliente y el servidor lleva el saldo real. */
  public async recordLoyaltyMovement(
    businessId: string,
    movement: { customer_id: string; sale_id: string | null; points: number; kind: 'earn' | 'redeem' | 'adjust'; description: string }
  ) {
    if (!movement.points) return
    const customer = (await getLocalCustomers(businessId)).find((item) => item.id === movement.customer_id) as (LocalCustomer & { loyalty_points?: number }) | undefined
    if (customer) {
      await patchLocalCustomer(customer.id, { loyalty_points: Math.max(0, (Number(customer.loyalty_points) || 0) + movement.points) } as Partial<LocalCustomer>)
    }
    await this.createRow('loyalty_movements', businessId, {
      ...movement,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    })
  }

  public async recordCustomerPayment(
    businessId: string,
    userId: string,
    customer: { id: string; balance: number },
    amount: number,
    notes: string
  ) {
    await patchLocalCustomer(customer.id, { balance: Math.max(0, Math.round((customer.balance - amount) * 100) / 100) })
    await this.enqueue('CUSTOMER_PAYMENT', {
      business_id: businessId,
      user_id: userId,
      payment: { id: crypto.randomUUID(), customer_id: customer.id, amount, notes },
    } satisfies CustomerPaymentPayload)
    this.afterLocalWrite()
  }

  /**
   * Queue a sale. Durably stores the operation before decrementing visible local stock.
   */
  public async queueOfflineSale(payload: LocalSalePayload): Promise<SyncOperation> {
    await this.init()
    const deviceId = await getDeviceId()
    const operationId = crypto.randomUUID()
    const idempotencyKey = crypto.randomUUID()

    // Fiscal documents are never approved locally. ARCA authorization remains online-only.
    payload.sale.fiscal_status = 'pending'
    payload.sale.device_id = deviceId

    const op: SyncOperation = {
      operation_id: operationId,
      operation_type: 'CREATE_SALE',
      payload: {
        ...payload,
        idempotency_key: idempotencyKey,
      },
      idempotency_key: idempotencyKey,
      device_id: deviceId,
      status: 'pending',
      retry_count: 0,
      last_attempt: null,
      created_at: new Date().toISOString(),
      last_error: null,
    }

    // Persist first, then update the visible local stock. The durable queue survives restarts.
    await queueSyncOperation(op)
    await saveLocalSale(payload, 'pending')
    if (payload.customerToCreate) await upsertLocalCustomer(payload.customerToCreate)
    for (const stockUpdate of payload.stockUpdates) {
      await decrementLocalStock(stockUpdate.productId, stockUpdate.qty)
    }
    if (payload.accountUpdate) {
      const customers = await getLocalCustomers(payload.sale.business_id)
      const customer = customers.find((item) => item.id === payload.accountUpdate!.customerId)
      if (customer) {
        await patchLocalCustomer(customer.id, {
          balance: Math.round(((Number(customer.balance) || 0) + payload.accountUpdate.amount) * 100) / 100,
        })
      }
    }
    this.afterLocalWrite()
    return op
  }

  // ──────────────────────────────────────────────
  // ENVÍO DE LA COLA
  // ──────────────────────────────────────────────

  /**
   * Process pending sync queue in chronological order.
   * Uses idempotency keys to strictly avoid duplicate transactions.
   * A network error stops the run (and keeps the order); a server error marks the
   * operation as failed with backoff and moves on to the next one.
   */
  public async processQueue(forceRetry = false): Promise<{ synced: number; failed: number }> {
    if (this.isProcessing || !isOnline()) {
      return { synced: 0, failed: 0 }
    }

    this.isProcessing = true
    await this.notifyListeners()

    let syncedCount = 0
    let failedCount = 0

    try {
      const operations = await getPendingOperations()
      if (operations.length === 0) return { synced: 0, failed: 0 }

      // Sin sesión (se ingresó offline) el servidor rechazaría todo por permisos:
      // se espera a que el usuario vuelva a ingresar su contraseña.
      const session = await supabase.auth.getSession().then(({ data }) => data.session, () => undefined)
      if (session === undefined) return { synced: 0, failed: 0 }
      this.needsLogin = !session
      if (!session) return { synced: 0, failed: 0 }

      for (const op of operations) {
        if (!forceRetry && op.retry_count >= MAX_AUTO_RETRIES) continue
        if (!forceRetry && op.last_attempt && op.retry_count > 0) {
          const timeSinceLast = Date.now() - new Date(op.last_attempt).getTime()
          if (timeSinceLast < backoffDelayMs(op.retry_count)) continue
        }

        await updateOperationStatus(op.operation_id, 'syncing')

        try {
          await this.executeOperation(op)
          if (op.operation_type === 'CREATE_SALE') {
            await updateLocalSaleStatus((op.payload as LocalSalePayload).sale.id, 'synced')
          }
          await removeOperation(op.operation_id)
          syncedCount++
        } catch (err: any) {
          if (isNetworkError(err)) {
            // Se cortó la conexión: no cuenta como intento fallido, se retoma al reconectar.
            await updateOperationStatus(op.operation_id, 'pending', null)
            reportNetworkFailure()
            break
          }
          console.error(`[CajaGo Sync] Failed operation ${op.operation_id}:`, err)
          await updateOperationStatus(op.operation_id, 'failed', err?.message || 'Error de sincronización')
          if (op.operation_type === 'CREATE_SALE') {
            await updateLocalSaleStatus((op.payload as LocalSalePayload).sale.id, 'failed')
          }
          failedCount++
        }
      }

      if (syncedCount > 0) {
        this.lastSyncAt = new Date().toISOString()
      }
    } finally {
      this.isProcessing = false
      await this.notifyListeners()
    }

    if (syncedCount > 0) this.syncedListeners.forEach((fn) => fn())
    return { synced: syncedCount, failed: failedCount }
  }

  private async executeOperation(op: SyncOperation): Promise<void> {
    switch (op.operation_type) {
      case 'CREATE_SALE': return this.syncSaleOperation(op)
      case 'UPDATE_STOCK': return this.syncStockMovement(op)
      case 'CUSTOMER_PAYMENT': return this.syncCustomerPayment(op)
      case 'UPSERT_ROW':
      case 'UPDATE_ROW':
      case 'DELETE_ROW':
        return this.syncRowOperation(op)
      case 'RPC_CALL':
        return this.syncRpcOperation(op)
      default:
        throw new Error(`Operación de sincronización no soportada: ${op.operation_type}`)
    }
  }

  /** Guarda el avance parcial de una operación para que un reintento no repita pasos ya hechos. */
  private async persistProgress(op: SyncOperation) {
    await queueSyncOperation({ ...op, status: 'syncing' })
  }

  private async syncRowOperation(op: SyncOperation): Promise<void> {
    const { table, id, ids, values } = op.payload as RowOperationPayload
    const db = supabase as any

    if (op.operation_type === 'UPDATE_ROW' && ids) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db.from(table).update(values).in('id', ids.slice(i, i + 200))
        if (error) throw new Error(error.message)
      }
      return
    }

    const run = async (rowValues?: Record<string, any>) => {
      // Tablas de solo agregar (historial): un reenvío no debe intentar modificar la fila.
      if (op.operation_type === 'UPSERT_ROW') return db.from(table).upsert({ ...rowValues, id }, { onConflict: 'id', ignoreDuplicates: APPEND_ONLY_TABLES.has(table) })
      if (op.operation_type === 'UPDATE_ROW') return db.from(table).update(rowValues).eq('id', id)
      return db.from(table).delete().eq('id', id)
    }

    let { error } = await run(values)
    // Bases sin la migración AFIP de clientes: reintentar sin esas columnas.
    if (error?.code === 'PGRST204' && table === 'customers' && values) {
      const { doc_tipo: _docTipo, doc_nro: _docNro, iva_condition: _iva, ...baseValues } = values
      ;({ error } = await run(baseValues))
    }
    if (error) {
      if (error.code === '23503') {
        throw new Error('No se puede eliminar: tiene registros asociados (ventas, compras o movimientos)')
      }
      throw new Error(error.message)
    }
  }

  private async syncRpcOperation(op: SyncOperation): Promise<void> {
    const payload = op.payload as RpcOperationPayload
    const db = supabase as any

    // Un intento anterior pudo haber llegado al servidor sin que viéramos la respuesta.
    if (payload.attempted_at && payload.dedupe) {
      const since = new Date(new Date(payload.attempted_at).getTime() - DEDUPE_CLOCK_MARGIN_MS).toISOString()
      let query = db.from(payload.dedupe.table).select('id').eq('business_id', payload.business_id).gte('created_at', since)
      for (const [column, value] of Object.entries(payload.dedupe.match)) {
        query = value === null ? query.is(column, null) : query.eq(column, value)
      }
      const { data, error } = await query.limit(1)
      if (error) throw new Error(error.message)
      if (data?.length) return
    }

    payload.attempted_at = new Date().toISOString()
    await this.persistProgress(op)

    const { error } = await db.rpc(payload.rpc, payload.args)
    if (error) {
      if (payload.duplicate_error && String(error.message).includes(payload.duplicate_error)) return
      throw new Error(error.message)
    }
  }

  /** Ventas hechas en este equipo que todavía no llegaron al servidor (para sumarlas en pantallas). */
  public async getPendingSales(businessId: string): Promise<LocalSalePayload[]> {
    await this.init()
    return (await getPendingOperations())
      .filter((op) => op.operation_type === 'CREATE_SALE' && operationBusinessId(op) === businessId)
      .map((op) => op.payload as LocalSalePayload)
  }

  /** Operaciones de servidor pendientes de un tipo, para mostrarlas en los listados. */
  public async getPendingRpc(businessId: string, rpc: string): Promise<SyncOperation[]> {
    await this.init()
    return (await getPendingOperations()).filter((op) =>
      op.operation_type === 'RPC_CALL' &&
      operationBusinessId(op) === businessId &&
      (op.payload as RpcOperationPayload).rpc === rpc
    )
  }

  /** Guarda una función del servidor para ejecutarla al volver la conexión. */
  public async queueRpc(payload: RpcOperationPayload): Promise<SyncOperation> {
    const op = await this.enqueue('RPC_CALL', payload)
    this.afterLocalWrite()
    return op
  }

  private async applyRemoteStockDelta(productId: string, delta: number): Promise<{ name: string; before: number }> {
    const { data: product, error } = await supabase
      .from('products')
      .select('name, stock')
      .eq('id', productId)
      .single()
    if (error) throw new Error(error.message)
    if (!product) throw new Error(`No se encontró el producto ${productId}`)

    const before = Number(product.stock) || 0
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: Math.max(0, Math.round((before + delta) * 1000) / 1000) })
      .eq('id', productId)
    if (stockError) throw new Error(`No se pudo actualizar el stock: ${stockError.message}`)
    return { name: product.name || 'Producto', before }
  }

  private async syncStockMovement(op: SyncOperation): Promise<void> {
    const payload = op.payload as StockMovementPayload & { stock_applied?: boolean }
    const { movement } = payload

    const { data: existing, error: existingError } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('id', movement.id)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) return

    if (!payload.stock_applied) {
      await this.applyRemoteStockDelta(movement.product_id, movement.quantity)
      payload.stock_applied = true
      await this.persistProgress(op)
    }

    const row: Record<string, any> = {
      id: movement.id,
      business_id: payload.business_id,
      product_id: movement.product_id,
      type: movement.type,
      quantity: movement.quantity,
    }
    if (movement.notes) row.notes = movement.notes
    const { error } = await supabase.from('stock_movements').upsert(row as any, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`No se pudo registrar el movimiento de stock: ${error.message}`)
  }

  private async syncCustomerPayment(op: SyncOperation): Promise<void> {
    const payload = op.payload as CustomerPaymentPayload & { account_applied?: boolean }
    const { payment } = payload

    const { data: existing, error: existingError } = await supabase
      .from('customer_payments')
      .select('id')
      .eq('id', payment.id)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) return

    if (!payload.account_applied) {
      const { error } = await (supabase as any).rpc('apply_account_payment', {
        p_business_id: payload.business_id,
        p_customer_id: payment.customer_id,
        p_amount: payment.amount,
        p_note: payment.notes,
        p_user_id: payload.user_id,
      })
      if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
      payload.account_applied = true
      await this.persistProgress(op)
    }

    const { error } = await supabase.from('customer_payments').upsert({
      id: payment.id,
      business_id: payload.business_id,
      customer_id: payment.customer_id,
      amount: payment.amount,
      notes: payment.notes,
    } as any, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`No se pudo registrar el pago: ${error.message}`)
  }

  /**
   * Strictly idempotent sale sync against Supabase.
   */
  private async syncSaleOperation(op: SyncOperation): Promise<void> {
    const payload = op.payload as LocalSalePayload & {
      stockUpdates: Array<LocalSalePayload['stockUpdates'][number] & { applied?: boolean }>
    }
    const idempotencyKey = op.idempotency_key

    if (payload.customerToCreate) {
      const { error } = await supabase
        .from('customers')
        .upsert(payload.customerToCreate, { onConflict: 'id' })
      if (error) throw new Error(`No se pudo sincronizar el cliente: ${error.message}`)
    }

    const { data: existingSale, error: existingSaleError } = await supabase
      .from('sales')
      .select('id')
      .eq('id', payload.sale.id)
      .maybeSingle()
    if (existingSaleError) throw new Error(existingSaleError.message)

    let remoteSaleId = existingSale?.id

    if (!remoteSaleId) {
      const { fiscal_status: _fiscalStatus, device_id: _deviceId, ...sale } = payload.sale
      const saleInsertData = {
        ...sale,
        note: sale.note ? `${sale.note} [offline:${idempotencyKey}]` : `[offline:${idempotencyKey}]`,
      }

      const { data: createdSale, error: saleError } = await supabase
        .from('sales')
        .insert(saleInsertData)
        .select()
        .single()

      if (saleError || !createdSale) {
        throw new Error(saleError?.message || 'Error al registrar venta remota')
      }

      remoteSaleId = createdSale.id
    }

    if (payload.items.length > 0) {
      const items = payload.items.map((item) => ({ ...item, sale_id: remoteSaleId }))
      const { error } = await supabase.from('sale_items').upsert(items, { onConflict: 'id' })
      if (error) {
        throw new Error(`No se pudieron sincronizar los productos de la venta: ${error.message}`)
      }
    }

    if (payload.payments.length > 0) {
      const payments = payload.payments.map((payment) => ({ ...payment, sale_id: remoteSaleId }))
      const { error } = await supabase.from('sale_payments').upsert(payments, { onConflict: 'id' })
      if (error) {
        throw new Error(`No se pudieron sincronizar los pagos: ${error.message}`)
      }
    }

    for (const stockUpdate of payload.stockUpdates) {
      const { data: existingMovement, error: movementLookupError } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('id', stockUpdate.movementId)
        .maybeSingle()
      if (movementLookupError) throw new Error(movementLookupError.message)
      if (existingMovement) continue

      if (!stockUpdate.applied) {
        const { name, before } = await this.applyRemoteStockDelta(stockUpdate.productId, -stockUpdate.qty)
        if (before < stockUpdate.qty) {
          // Otra caja vendió el mismo stock mientras esta estaba offline: queda registrado para revisar.
          await recordStockConflict({
            conflict_id: crypto.randomUUID(),
            sale_id: remoteSaleId,
            product_id: stockUpdate.productId,
            product_name: name,
            requested_qty: stockUpdate.qty,
            server_qty: before,
            resolved: false,
            created_at: new Date().toISOString(),
          })
        }
        stockUpdate.applied = true
        await this.persistProgress(op)
      }

      const { error: movementError } = await supabase.from('stock_movements').upsert({
        id: stockUpdate.movementId,
        business_id: payload.sale.business_id,
        product_id: stockUpdate.productId,
        type: 'sale',
        quantity: -stockUpdate.qty,
        reference_id: remoteSaleId,
      }, { onConflict: 'id', ignoreDuplicates: true })
      if (movementError) {
        throw new Error(`No se pudo registrar el movimiento de stock: ${movementError.message}`)
      }
    }

    if (payload.accountUpdate) {
      const { data: existingCharge, error: chargeLookupError } = await supabase
        .from('account_movements')
        .select('id')
        .eq('sale_id', remoteSaleId)
        .eq('type', 'charge')
        .maybeSingle()
      if (chargeLookupError) throw new Error(chargeLookupError.message)

      if (!existingCharge) {
        const { error } = await supabase.rpc('charge_customer_account', {
          p_business_id: payload.sale.business_id,
          p_customer_id: payload.accountUpdate.customerId,
          p_amount: payload.accountUpdate.amount,
          p_sale_id: remoteSaleId,
          p_user_id: payload.sale.seller_id,
        })
        if (error) throw new Error(`No se pudo actualizar la cuenta corriente: ${error.message}`)
      }
    }
  }

  // ──────────────────────────────────────────────
  // DESCARGA (servidor → base local)
  // ──────────────────────────────────────────────

  /**
   * Pull fresh product catalog to the local DB. If there are local writes still waiting
   * to sync (or the server is unreachable) the local snapshot is returned untouched.
   */
  public async pullLatestProducts(businessId: string): Promise<LocalProduct[]> {
    await this.init()
    if (!isOnline() || await this.hasPendingWrites(businessId, 'products')) return getLocalProducts(businessId)

    try {
      const data = await fetchAllProductsInBatches(businessId)
      const mapped: LocalProduct[] = data.map((p: any) => ({
        ...p,
        sale_price: Number(p.sale_price) || 0,
        purchase_price: Number(p.purchase_price) || 0,
        avg_cost: Number(p.avg_cost) || 0,
        unit: p.unit || 'u',
        stock: Number(p.stock) || 0,
        stock_min: Number(p.stock_min) || 0,
        active: Boolean(p.active),
        updated_at: p.updated_at || p.created_at || new Date().toISOString(),
      }))

      // Una venta pudo entrar a la cola mientras descargábamos.
      if (await this.hasPendingWrites(businessId, 'products')) return getLocalProducts(businessId)
      await saveLocalProducts(mapped, businessId)
      return mapped
    } catch (err) {
      if (isNetworkError(err)) reportNetworkFailure()
      console.warn('[CajaGo Sync] Failed to pull latest products:', err)
      return getLocalProducts(businessId)
    }
  }

  public async pullLatestCustomers(businessId: string): Promise<LocalCustomer[]> {
    await this.init()
    if (!isOnline() || await this.hasPendingWrites(businessId, 'customers')) return getLocalCustomers(businessId)

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .order('name')

      if (error || !data) throw error || new Error('Sin datos')
      const customers = data as LocalCustomer[]
      if (await this.hasPendingWrites(businessId, 'customers')) return getLocalCustomers(businessId)
      await saveLocalCustomers(customers, businessId)
      return customers
    } catch (error) {
      if (isNetworkError(error)) reportNetworkFailure()
      console.warn('[CajaGo Sync] Failed to pull latest customers:', error)
      return getLocalCustomers(businessId)
    }
  }

  /** Descarga genérica para tablas secundarias guardadas en local_rows. */
  public async pullRows<T extends { id: string }>(
    table: SyncTable,
    businessId: string,
    fetchRemote: () => PromiseLike<{ data: T[] | null; error: any }>
  ): Promise<T[]> {
    await this.init()
    if (!isOnline() || await this.hasPendingWrites(businessId, table)) return getLocalRows<T>(table, businessId)

    try {
      const { data, error } = await fetchRemote()
      if (error || !data) throw error || new Error('Sin datos')
      if (await this.hasPendingWrites(businessId, table)) return getLocalRows<T>(table, businessId)
      await saveLocalRows(table, businessId, data)
      return data
    } catch (error) {
      if (isNetworkError(error)) reportNetworkFailure()
      console.warn(`[CajaGo Sync] Failed to pull ${table}:`, error)
      return getLocalRows<T>(table, businessId)
    }
  }
}

export const syncEngine = new SyncEngine()

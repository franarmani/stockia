/**
 * Simula cortes de Internet / Supabase caído y la recuperación posterior contra
 * una base local en memoria y un Supabase falso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, any>

const fake = vi.hoisted(() => {
  const state = {
    reachable: true,
    session: { user: { id: 'usr' } } as Row | null,
    tables: {} as Record<string, Row[]>,
    failures: [] as Array<{ table: string; action: string; kind: 'network' | 'server' }>,
    rpcCalls: [] as Array<{ name: string; args: Row }>,
    queue: new Map<string, Row>(),
    localProducts: new Map<string, Row>(),
    localCustomers: new Map<string, Row>(),
    localRows: new Map<string, Row>(),
    conflicts: [] as Row[],
    config: new Map<string, string>(),
  }

  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

  function takeFailure(table: string, action: string) {
    const index = state.failures.findIndex((f) => f.table === table && f.action === action)
    if (index === -1) return null
    const [failure] = state.failures.splice(index, 1)
    return failure.kind === 'network'
      ? { message: 'TypeError: Failed to fetch', code: '' }
      : { message: 'new row violates check constraint', code: '23514' }
  }

  function from(table: string) {
    const rows = (state.tables[table] ||= [])
    const filters: Array<(row: Row) => boolean> = []
    let action = 'select'
    let values: any
    let options: Row | undefined
    let single: 'one' | 'maybe' | null = null

    const exec = () => {
      const error = takeFailure(table, action)
      if (error) return { data: null, error }
      const matches = (row: Row) => filters.every((filter) => filter(row))
      if (action === 'select') {
        const found = rows.filter(matches).map(clone)
        return { data: single ? found[0] ?? null : found, error: null }
      }
      if (action === 'update') {
        rows.filter(matches).forEach((row) => Object.assign(row, values))
        return { data: null, error: null }
      }
      if (action === 'delete') {
        state.tables[table] = rows.filter((row) => !matches(row))
        return { data: null, error: null }
      }
      const list = Array.isArray(values) ? values : [values]
      for (const value of list) {
        const existing = rows.find((row) => row.id === value.id)
        if (existing && !options?.ignoreDuplicates) Object.assign(existing, value)
        if (!existing) rows.push(clone(value))
      }
      return { data: single ? clone(list[0]) : clone(list), error: null }
    }

    const builder: Row = {
      select: () => builder,
      order: () => builder,
      range: () => builder,
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder },
      in: (column: string, list: unknown[]) => { filters.push((row) => list.includes(row[column])); return builder },
      is: (column: string, value: unknown) => { filters.push((row) => (row[column] ?? null) === value); return builder },
      gte: (column: string, value: string) => { filters.push((row) => String(row[column]) >= value); return builder },
      limit: () => builder,
      update: (next: Row) => { action = 'update'; values = next; return builder },
      delete: () => { action = 'delete'; return builder },
      insert: (next: Row) => { action = 'insert'; values = next; return builder },
      upsert: (next: Row, opts?: Row) => { action = 'upsert'; values = next; options = opts; return builder },
      single: () => { single = 'one'; return builder },
      maybeSingle: () => { single = 'maybe'; return builder },
      then: (resolve: any, reject: any) => Promise.resolve().then(exec).then(resolve, reject),
    }
    return builder
  }

  const supabase = {
    from,
    rpc: async (name: string, args: Row) => {
      const error = takeFailure(`rpc:${name}`, 'call')
      if (error) return { data: null, error }
      state.rpcCalls.push({ name, args })
      if (name === 'record_supplier_payment') {
        // Simula lo que crea la función real (es lo que busca el anti-duplicado)
        ;(state.tables.supplier_payments ||= []).push({
          id: `pay-${state.rpcCalls.length}`, business_id: 'biz-1', supplier_id: args.p_supplier_id, amount: args.p_amount,
          payment_date: args.p_payment_date, payment_method_id: args.p_payment_method_id, created_at: new Date().toISOString(),
        })
      }
      // La respuesta se pierde después de que el servidor ya guardó (corte en el peor momento)
      const lost = takeFailure(`rpc:${name}`, 'response')
      if (lost) return { data: null, error: lost }
      return { data: 'server-id', error: null }
    },
    auth: { getSession: async () => ({ data: { session: state.session }, error: null }) },
  }

  return { state, supabase, clone }
})

vi.mock('@/lib/supabase', () => ({
  supabase: fake.supabase,
  pingSupabase: async () => fake.state.reachable,
}))
vi.mock('@/lib/productService', () => ({
  fetchAllProductsInBatches: async (businessId: string) =>
    (fake.state.tables.products || []).filter((p) => p.business_id === businessId),
}))
vi.mock('../../desktop/device', () => ({ getDeviceId: async () => 'device-test' }))
vi.mock('../legacyMigration', () => ({ migrateLegacyOfflineSales: async () => 0 }))
vi.mock('../storage', () => {
  const { state, clone } = fake
  const byCreated = (a: Row, b: Row) => a.created_at.localeCompare(b.created_at)
  return {
    checkIsTauriDesktop: () => true,
    initStorage: async () => {},
    queueSyncOperation: async (op: Row) => { state.queue.set(op.operation_id, clone(op)) },
    getPendingOperations: async () => [...state.queue.values()].map(clone).sort(byCreated),
    updateOperationStatus: async (id: string, status: string, lastError?: string | null) => {
      const op = state.queue.get(id)
      if (!op) return
      op.status = status
      op.last_attempt = new Date().toISOString()
      if (lastError !== undefined) op.last_error = lastError
      if (status === 'failed') op.retry_count += 1
    },
    removeOperation: async (id: string) => { state.queue.delete(id) },
    getLocalProducts: async () => [...state.localProducts.values()].map(clone),
    saveLocalProducts: async (products: Row[]) => {
      state.localProducts.clear()
      products.forEach((p) => state.localProducts.set(p.id, clone(p)))
    },
    patchLocalProduct: async (id: string, patch: Row, businessId?: string) => {
      const current = state.localProducts.get(id) || (businessId ? { id, business_id: businessId } : null)
      if (current) state.localProducts.set(id, { ...current, ...patch })
    },
    adjustLocalStock: async (id: string, delta: number) => {
      const product = state.localProducts.get(id)
      if (product) product.stock = Math.max(0, product.stock + delta)
    },
    decrementLocalStock: async (id: string, qty: number) => {
      const product = state.localProducts.get(id)
      if (product) product.stock = Math.max(0, product.stock - qty)
    },
    getLocalCustomers: async () => [...state.localCustomers.values()].map(clone),
    saveLocalCustomers: async (customers: Row[]) => {
      state.localCustomers.clear()
      customers.forEach((c) => state.localCustomers.set(c.id, clone(c)))
    },
    upsertLocalCustomer: async (customer: Row) => { state.localCustomers.set(customer.id, clone(customer)) },
    patchLocalCustomer: async (id: string, patch: Row, businessId?: string) => {
      const current = state.localCustomers.get(id) || (businessId ? { id, business_id: businessId } : null)
      if (current) state.localCustomers.set(id, { ...current, ...patch })
    },
    deleteLocalCustomer: async (id: string) => { state.localCustomers.delete(id) },
    saveLocalSale: async () => {},
    updateLocalSaleStatus: async () => {},
    recordStockConflict: async (conflict: Row) => { state.conflicts.push(conflict) },
    getStockConflicts: async () => state.conflicts.filter((c) => !c.resolved),
    resolveStockConflict: async () => {},
    saveLocalRows: async (table: string, _businessId: string, rows: Row[]) => {
      for (const key of [...state.localRows.keys()]) if (key.startsWith(`${table}:`)) state.localRows.delete(key)
      rows.forEach((row) => state.localRows.set(`${table}:${row.id}`, clone(row)))
    },
    getLocalRows: async (table: string) =>
      [...state.localRows.entries()].filter(([key]) => key.startsWith(`${table}:`)).map(([, row]) => clone(row)),
    upsertLocalRow: async (table: string, _businessId: string, row: Row) => {
      const key = `${table}:${row.id}`
      state.localRows.set(key, { ...(state.localRows.get(key) || {}), ...row })
    },
    deleteLocalRow: async (table: string, id: string) => { state.localRows.delete(`${table}:${id}`) },
    getLocalConfig: async (key: string) => state.config.get(key) ?? null,
    setLocalConfig: async (key: string, value: string) => { state.config.set(key, value) },
  }
})

const BIZ = 'biz-1'

async function loadEngine() {
  vi.resetModules()
  const connectivity = await import('../connectivity')
  const { syncEngine } = await import('../syncEngine')
  const remoteAccess = await import('../remote')
  return { connectivity, syncEngine, remoteAccess }
}

async function goOffline(connectivity: Awaited<ReturnType<typeof loadEngine>>['connectivity']) {
  fake.state.reachable = false
  await connectivity.checkConnectivity()
}

async function goOnline(connectivity: Awaited<ReturnType<typeof loadEngine>>['connectivity']) {
  fake.state.reachable = true
  await connectivity.checkConnectivity()
}

const queuedOps = () => [...fake.state.queue.values()]
const remote = (table: string) => fake.state.tables[table] || []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
  const { state } = fake
  state.reachable = false
  state.session = { user: { id: 'usr' } }
  state.failures = []
  state.rpcCalls = []
  state.queue.clear()
  state.localProducts.clear()
  state.localCustomers.clear()
  state.localRows.clear()
  state.conflicts = []
  state.config.clear()
  state.tables = {
    products: [{ id: 'p1', business_id: BIZ, name: 'Cemento', stock: 10, stock_min: 2, active: true }],
    customers: [{ id: 'c1', business_id: BIZ, name: 'Obra Pérez', balance: 500 }],
    stock_movements: [],
    customer_payments: [],
    cash_sessions: [],
    cash_movements: [],
  }
  state.localProducts.set('p1', { id: 'p1', business_id: BIZ, name: 'Cemento', stock: 10, stock_min: 2, active: true })
  state.localCustomers.set('c1', { id: 'c1', business_id: BIZ, name: 'Obra Pérez', balance: 500 })
})

describe('local-first operation with internet cuts', () => {
  it('keeps working offline and syncs everything in order when the connection returns', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)

    const sessionId = crypto.randomUUID()
    await syncEngine.createRow('cash_sessions', BIZ, { id: sessionId, opened_by: 'usr', opening_amount: 1000, status: 'open', opened_at: new Date().toISOString() })
    await syncEngine.createRow('cash_movements', BIZ, { id: crypto.randomUUID(), session_id: sessionId, type: 'withdrawal', amount: 200, description: 'Retiro', created_at: new Date().toISOString() })
    await syncEngine.adjustStock(BIZ, 'p1', -3, 'adjustment', 'Rotura')
    await syncEngine.recordCustomerPayment(BIZ, 'usr', { id: 'c1', balance: 500 }, 200, 'Pago parcial')

    // Nada salió al servidor, pero la base local ya refleja todo
    expect(remote('cash_sessions')).toHaveLength(0)
    expect(fake.state.localProducts.get('p1')!.stock).toBe(7)
    expect(fake.state.localCustomers.get('c1')!.balance).toBe(300)
    expect(fake.state.localRows.get(`cash_sessions:${sessionId}`)).toMatchObject({ status: 'open' })
    expect((await syncEngine.getStats()).pendingCount).toBe(4)

    await goOnline(connectivity)
    const result = await syncEngine.processQueue()

    expect(result).toEqual({ synced: 4, failed: 0 })
    expect(queuedOps()).toHaveLength(0)
    expect(remote('cash_sessions')[0]).toMatchObject({ id: sessionId, business_id: BIZ, opening_amount: 1000 })
    expect(remote('cash_movements')[0]).toMatchObject({ session_id: sessionId, amount: 200 })
    expect(remote('cash_movements')[0]).not.toHaveProperty('business_id')
    expect(remote('products')[0].stock).toBe(7)
    expect(remote('stock_movements')[0]).toMatchObject({ product_id: 'p1', quantity: -3, notes: 'Rotura' })
    expect(fake.state.rpcCalls).toEqual([expect.objectContaining({ name: 'apply_account_payment' })])
    expect(remote('customer_payments')[0]).toMatchObject({ customer_id: 'c1', amount: 200 })
  })

  it('a network drop mid-sync keeps the operation pending without spending a retry', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.adjustStock(BIZ, 'p1', 5, 'purchase')
    await syncEngine.createRow('categories', BIZ, { id: 'cat-1', name: 'Áridos' })

    await goOnline(connectivity)
    fake.state.failures.push({ table: 'stock_movements', action: 'select', kind: 'network' })
    expect(await syncEngine.processQueue()).toEqual({ synced: 0, failed: 0 })

    expect(connectivity.isOnline()).toBe(false)
    expect(queuedOps().map((op) => [op.status, op.retry_count])).toEqual([['pending', 0], ['pending', 0]])
    expect(remote('categories') || []).toHaveLength(0) // el orden se respeta: no se saltea la anterior

    await goOnline(connectivity)
    expect(await syncEngine.processQueue()).toEqual({ synced: 2, failed: 0 })
    expect(remote('products')[0].stock).toBe(15)
  })

  it('never applies a stock delta twice when the connection drops after updating stock', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.adjustStock(BIZ, 'p1', -4, 'adjustment')

    await goOnline(connectivity)
    fake.state.failures.push({ table: 'stock_movements', action: 'upsert', kind: 'network' })
    await syncEngine.processQueue()
    expect(remote('products')[0].stock).toBe(6)
    expect(queuedOps()).toHaveLength(1)

    await goOnline(connectivity)
    await syncEngine.processQueue()
    expect(remote('products')[0].stock).toBe(6)
    expect(remote('stock_movements')).toHaveLength(1)
    expect(queuedOps()).toHaveLength(0)
  })

  it('stock deltas from two offline registers add up instead of overwriting each other', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.adjustStock(BIZ, 'p1', -2, 'adjustment')
    // Mientras tanto otra caja ya vendió 3 unidades en el servidor
    remote('products')[0].stock = 7

    await goOnline(connectivity)
    await syncEngine.processQueue()
    expect(remote('products')[0].stock).toBe(5)
  })

  it('a server rejection marks the operation as failed, keeps going, and backs off', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.updateRow('products', BIZ, 'p1', { name: 'Cemento x50kg' })
    await syncEngine.createRow('categories', BIZ, { id: 'cat-1', name: 'Áridos' })

    await goOnline(connectivity)
    fake.state.failures.push({ table: 'products', action: 'update', kind: 'server' })
    expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 1 })

    const [failed] = queuedOps()
    expect(failed).toMatchObject({ status: 'failed', retry_count: 1 })
    expect(failed.last_error).toContain('violates')
    expect(remote('categories')).toHaveLength(1)
    expect((await syncEngine.getStats()).failedCount).toBe(1)

    // Dentro del backoff no se reintenta solo; forzado sí
    expect(await syncEngine.processQueue()).toEqual({ synced: 0, failed: 0 })
    expect(await syncEngine.processQueue(true)).toEqual({ synced: 1, failed: 0 })
    expect(remote('products')[0].name).toBe('Cemento x50kg')
  })

  it('records a stock conflict when an offline sale exceeds the server stock', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    const saleId = crypto.randomUUID()
    await syncEngine.queueOfflineSale({
      sale: { id: saleId, business_id: BIZ, customer_id: null, total: 100, payment_method: 'cash', seller_id: 'usr', receipt_type: 'ticket', fiscal_status: 'pending', device_id: '', created_at: new Date().toISOString() },
      items: [{ id: crypto.randomUUID(), sale_id: saleId, product_id: 'p1', quantity: 4, price: 25, cost_at_sale: 10 }],
      payments: [{ id: crypto.randomUUID(), sale_id: saleId, payment_method: 'cash', amount: 100 }],
      stockUpdates: [{ productId: 'p1', newStock: 6, qty: 4, movementId: crypto.randomUUID() }],
    })
    remote('products')[0].stock = 1

    await goOnline(connectivity)
    expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 0 })
    expect(remote('sales')).toHaveLength(1)
    expect(remote('products')[0].stock).toBe(0)
    expect(fake.state.conflicts).toEqual([expect.objectContaining({ product_id: 'p1', requested_qty: 4, server_qty: 1 })])

    // Reprocesar no duplica la venta ni el movimiento
    await syncEngine.processQueue(true)
    expect(remote('sales')).toHaveLength(1)
    expect(remote('stock_movements')).toHaveLength(1)
  })

  it('waits for a real session before sending (user logged in offline)', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.adjustStock(BIZ, 'p1', 1, 'purchase')

    fake.state.session = null
    await goOnline(connectivity)
    expect(await syncEngine.processQueue()).toEqual({ synced: 0, failed: 0 })
    expect((await syncEngine.getStats()).needsLogin).toBe(true)
    expect(queuedOps()[0]).toMatchObject({ status: 'pending', retry_count: 0 })

    fake.state.session = { user: { id: 'usr' } }
    expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 0 })
    expect((await syncEngine.getStats()).needsLogin).toBe(false)
  })

  it('does not overwrite local data with a server pull while writes are pending', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    await syncEngine.adjustStock(BIZ, 'p1', -1, 'adjustment')
    fake.state.session = null // la cola no puede vaciarse todavía
    await goOnline(connectivity)

    const products = await syncEngine.pullLatestProducts(BIZ)
    expect(products[0].stock).toBe(9)
    expect(fake.state.localProducts.get('p1')!.stock).toBe(9)
  })

  it('refuses to discard sales but allows discarding other rejected operations', async () => {
    const { connectivity, syncEngine } = await loadEngine()
    await goOffline(connectivity)
    const saleId = crypto.randomUUID()
    await syncEngine.queueOfflineSale({
      sale: { id: saleId, business_id: BIZ, customer_id: null, total: 10, payment_method: 'cash', seller_id: 'usr', receipt_type: 'ticket', fiscal_status: 'pending', device_id: '', created_at: new Date().toISOString() },
      items: [],
      payments: [],
      stockUpdates: [],
    })
    await syncEngine.deleteRow('customers', BIZ, 'c1')
    const [saleOp, deleteOp] = queuedOps()

    await expect(syncEngine.discardOperation(saleOp.operation_id)).rejects.toThrow('no se pueden descartar')
    await syncEngine.discardOperation(deleteOp.operation_id)
    expect(queuedOps().map((op) => op.operation_type)).toEqual(['CREATE_SALE'])
  })
})

describe('server functions (purchases, payments, entries) without connection', () => {
  const payment = (attempt = '2026-10-25') => ({
    business_id: BIZ,
    rpc: 'record_supplier_payment',
    args: { p_supplier_id: 'sup-1', p_amount: '1500.00', p_payment_date: attempt, p_payment_method_id: 'cash' },
    label: 'Pago a proveedor',
    tables: ['purchases'],
    dedupe: { table: 'supplier_payments', match: { supplier_id: 'sup-1', amount: '1500.00', payment_date: attempt, payment_method_id: 'cash' } },
  })

  it('runs immediately when online and queues when offline', async () => {
    const { connectivity, syncEngine, remoteAccess } = await loadEngine()
    await goOnline(connectivity)
    expect(await remoteAccess.callRpcOrQueue(payment())).toBe('server-id')
    expect(queuedOps()).toHaveLength(0)

    await goOffline(connectivity)
    expect(await remoteAccess.callRpcOrQueue(payment('2026-10-26'))).toBeNull()
    expect(fake.state.rpcCalls).toHaveLength(1)
    expect((await syncEngine.getPendingRpc(BIZ, 'record_supplier_payment'))).toHaveLength(1)

    await goOnline(connectivity)
    expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 0 })
    expect(fake.state.rpcCalls).toHaveLength(2)
  })

  it('does not pay twice when the response is lost after the server saved the payment', async () => {
    const { connectivity, syncEngine, remoteAccess } = await loadEngine()
    await goOnline(connectivity)
    fake.state.failures.push({ table: 'rpc:record_supplier_payment', action: 'response', kind: 'network' })

    expect(await remoteAccess.callRpcOrQueue(payment())).toBeNull()
    expect(fake.state.rpcCalls).toHaveLength(1)
    expect(queuedOps()[0].payload.attempted_at).toBeTruthy()

    await goOnline(connectivity)
    expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 0 })
    expect(fake.state.rpcCalls).toHaveLength(1)
    expect(remote('supplier_payments')).toHaveLength(1)
  })

  it('treats the server "already registered" error as success for queued purchases', async () => {
    const { connectivity, syncEngine, remoteAccess } = await loadEngine()
    await goOffline(connectivity)
    await remoteAccess.callRpcOrQueue({
      business_id: BIZ, rpc: 'create_purchase_document', args: {}, label: 'Compra', tables: ['purchases'], duplicate_error: 'ya fue registrado',
    })
    await goOnline(connectivity)
    const original = fake.supabase.rpc
    fake.supabase.rpc = async () => ({ data: null, error: { message: 'El comprobante ya fue registrado', code: 'P0001' } })
    try {
      expect(await syncEngine.processQueue()).toEqual({ synced: 1, failed: 0 })
    } finally {
      fake.supabase.rpc = original
    }
  })

  it('validation errors from the server reach the user immediately when online', async () => {
    const { connectivity, remoteAccess } = await loadEngine()
    await goOnline(connectivity)
    fake.state.failures.push({ table: 'rpc:record_supplier_payment', action: 'call', kind: 'server' })
    await expect(remoteAccess.callRpcOrQueue(payment())).rejects.toMatchObject({ code: '23514' })
    expect(queuedOps()).toHaveLength(0)
  })

  it('cached reads return the last server data when offline', async () => {
    const { connectivity, remoteAccess } = await loadEngine()
    await goOnline(connectivity)
    expect(await remoteAccess.cachedRead('k', async () => [1, 2, 3])).toEqual([1, 2, 3])

    await goOffline(connectivity)
    const fetchRemote = vi.fn(async () => [9])
    expect(await remoteAccess.cachedRead('k', fetchRemote)).toEqual([1, 2, 3])
    expect(fetchRemote).not.toHaveBeenCalled()
    await expect(remoteAccess.cachedRead('never-loaded', fetchRemote)).rejects.toBeInstanceOf(remoteAccess.OfflineDataUnavailableError)
  })
})

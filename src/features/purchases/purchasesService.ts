import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { adjustLocalStock, getLocalRows } from '@/sync/storage'
import { isNetworkError, isOnline } from '@/sync/connectivity'
import { cachedRead, callRpcOrQueue } from '@/sync/remote'
import { normalizeCuit } from './cuit'
import { fromCents, multiplyMoney, toCents } from './money'
import type { PaymentMethod, PurchaseConcept, PurchaseDocument, PurchaseDraftItem, Supplier, SupplierLedgerMovement, TaxType } from './types'

const db = supabase as any

// Compras funciona local-first: altas y cambios simples se guardan en este equipo y se
// sincronizan; comprobantes y pagos usan funciones del servidor (asientos, cuenta corriente),
// que se ejecutan al instante con conexión o quedan en cola sin ella.

export async function initializePurchases(businessId: string) {
  if (!isOnline()) return
  const { error } = await db.rpc('seed_purchases_accounting', { p_business_id: businessId })
  if (error && !isNetworkError(error)) throw error
}

function fetchSuppliers(businessId: string) {
  return syncEngine.pullRows<Supplier>('suppliers', businessId, () =>
    db.from('suppliers').select('*').eq('business_id', businessId))
}

export async function listSuppliers(businessId: string, search = '', order = 'legal_name'): Promise<Supplier[]> {
  const term = search.trim().toLowerCase()
  const cuitTerm = normalizeCuit(term)
  const safeOrder = (['cuit', 'name', 'legal_name', 'created_at'].includes(order) ? order : 'legal_name') as keyof Supplier
  return (await fetchSuppliers(businessId))
    .filter(supplier => !term ||
      (cuitTerm && supplier.cuit?.includes(cuitTerm)) ||
      [supplier.legal_name, supplier.trade_name, supplier.name].some(value => value?.toLowerCase().includes(term)))
    .sort((a, b) => String(a[safeOrder] ?? '￿').localeCompare(String(b[safeOrder] ?? '￿'), 'es'))
}

export async function saveSupplier(businessId: string, supplier: Partial<Supplier> & { legal_name: string; cuit: string }) {
  const payload = {
    name: supplier.trade_name?.trim() || supplier.legal_name.trim(),
    legal_name: supplier.legal_name.trim(),
    trade_name: supplier.trade_name?.trim() || null,
    cuit: normalizeCuit(supplier.cuit),
    vat_condition: supplier.vat_condition || null,
    address: supplier.address?.trim() || null,
    city: supplier.city?.trim() || null,
    province: supplier.province?.trim() || null,
    postal_code: supplier.postal_code?.trim() || null,
    phone: supplier.phone?.trim() || null,
    email: supplier.email?.trim() || null,
    notes: supplier.notes?.trim() || null,
    active: supplier.active ?? true,
    updated_at: new Date().toISOString(),
  }
  const existing = await fetchSuppliers(businessId)
  if (existing.some(item => item.id !== supplier.id && item.cuit && item.cuit === payload.cuit)) {
    throw new Error('Ya existe un proveedor con ese CUIT.')
  }

  if (supplier.id) {
    await syncEngine.updateRow('suppliers', businessId, supplier.id, payload)
    return { ...supplier, ...payload } as Supplier
  }
  const created = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  await syncEngine.createRow('suppliers', businessId, created)
  return created as Supplier
}

export async function lookupSupplierInArca(cuit: string) {
  if (!isOnline()) throw new Error('Sin conexión: la consulta a ARCA necesita Internet. Podés cargar los datos a mano.')
  const { data, error } = await supabase.functions.invoke('arca-supplier-lookup', { body: { cuit: normalizeCuit(cuit) } })
  if (error) throw new Error((data as any)?.reason || (data as any)?.error || 'ARCA no está configurado. Continúe con la carga manual.')
  return (data as any).supplier as Partial<Supplier>
}

export async function setSupplierActive(businessId: string, supplierId: string, active: boolean) {
  await syncEngine.updateRow('suppliers', businessId, supplierId, { active, updated_at: new Date().toISOString() })
}

export async function listPurchaseCatalogs(businessId: string) {
  const [concepts, taxes, methods] = await Promise.all([
    syncEngine.pullRows<PurchaseConcept>('purchase_concepts', businessId, () =>
      db.from('purchase_concepts').select('*').eq('business_id', businessId)),
    cachedRead(`tax_types:${businessId}`, async () => {
      const { data, error } = await db.from('tax_types').select('*').eq('business_id', businessId).order('kind').order('rate')
      if (error) throw error
      return data as TaxType[]
    }),
    cachedRead(`payment_methods:${businessId}`, async () => {
      const { data, error } = await db.from('payment_methods').select('*').eq('business_id', businessId).eq('active', true).order('name')
      if (error) throw error
      return data as PaymentMethod[]
    }),
  ])
  return { concepts: [...concepts].sort((a, b) => a.name.localeCompare(b.name, 'es')), taxes, methods }
}

export async function listPurchaseProducts(businessId: string) {
  return (await syncEngine.pullLatestProducts(businessId))
    .filter(product => product.active !== false)
    .map((p: any) => ({ id: p.id, name: p.name, barcode: p.barcode, code: p.code ?? null, stock: p.stock, unit: p.unit, purchase_price: p.purchase_price }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listPurchases(businessId: string): Promise<PurchaseDocument[]> {
  const [remote, pending] = await Promise.all([
    cachedRead(`purchases:${businessId}`, async () => {
      const { data, error } = await db.from('purchases')
        .select('*, supplier:suppliers(id,name,legal_name,cuit), purchase_items(id,description,quantity,unit_cost,subtotal,vat_rate,vat_amount,total)')
        .eq('business_id', businessId).order('document_date', { ascending: false }).limit(250)
      if (error) throw error
      return (data ?? []) as PurchaseDocument[]
    }),
    syncEngine.getPendingRpc(businessId, 'create_purchase_document'),
  ])
  // Los comprobantes cargados sin conexión se muestran como pendientes hasta sincronizar.
  const pendingRows = pending.map(op => ({ ...(op.payload as any).preview, id: op.operation_id }) as PurchaseDocument)
  return [...pendingRows, ...remote]
}

export async function createPurchase(input: {
  businessId: string
  supplierId: string
  document: Record<string, unknown>
  items: PurchaseDraftItem[]
  taxes?: Array<{ tax_type_id: string; taxable_base: string; rate: string; amount: string }>
  updateStock: boolean
}): Promise<string | null> {
  const normalizedItems = input.items.map(item => {
    const subtotalCents = multiplyMoney(item.unit_cost, item.quantity)
    const vatCents = Math.round(subtotalCents * Number(item.vat_rate || 0) / 100)
    return {
      product_id: item.product_id || null,
      concept_id: item.concept_id || null,
      description: item.description.trim(),
      quantity: Number(item.quantity).toFixed(3),
      unit_cost: fromCents(toCents(item.unit_cost)),
      subtotal: fromCents(subtotalCents),
      vat_rate: Number(item.vat_rate || 0).toFixed(4),
      vat_amount: fromCents(vatCents),
      total: fromCents(subtotalCents + vatCents),
    }
  })
  const subtotal = normalizedItems.reduce((sum, item) => sum + toCents(item.subtotal), 0)
  const vat = normalizedItems.reduce((sum, item) => sum + toCents(item.vat_amount), 0)
  const otherTaxes = (input.taxes ?? []).reduce((sum, tax) => sum + toCents(tax.amount), 0)
  const document: Record<string, any> = { ...input.document, subtotal: fromCents(subtotal), vat_total: fromCents(vat), total: fromCents(subtotal + vat + otherTaxes) }
  const supplier = (await getLocalRows<Supplier>('suppliers', input.businessId)).find(item => item.id === input.supplierId)

  let result: string | null
  try {
    result = await callRpcOrQueue<string>({
      business_id: input.businessId,
      rpc: 'create_purchase_document',
      args: {
        p_supplier_id: input.supplierId,
        p_document: document,
        p_items: normalizedItems,
        p_taxes: input.taxes ?? [],
        p_update_stock: input.updateStock,
      },
      label: `Compra a ${supplier?.legal_name || supplier?.name || 'proveedor'}`,
      tables: input.updateStock ? ['purchases', 'products'] : ['purchases'],
      dedupe: {
        table: 'purchases',
        match: { supplier_id: input.supplierId, document_date: String(document.document_date ?? ''), total: document.total },
      },
      duplicate_error: 'ya fue registrado',
      preview: {
        supplier_id: input.supplierId,
        document_type: document.document_type ?? 'internal',
        letter: document.letter ?? null,
        point_of_sale: document.point_of_sale ?? null,
        document_number: document.document_number ?? null,
        document_date: document.document_date,
        due_date: document.due_date ?? null,
        total: Number(document.total),
        vat_total: Number(document.vat_total),
        balance_due: Number(document.total),
        status: 'pending',
        is_fiscal: Boolean(document.is_fiscal),
        supplier: supplier ? { id: supplier.id, name: supplier.name, legal_name: supplier.legal_name, cuit: supplier.cuit } : null,
        purchase_items: normalizedItems.map(item => ({ ...item, id: crypto.randomUUID() })),
      },
    })
  } catch (error: any) {
    throw new Error(error?.message?.includes('ya fue registrado') ? 'Este comprobante ya fue registrado para este proveedor.' : error?.message)
  }

  // Sin conexión, el stock se refleja en este equipo hasta que el servidor procese la compra.
  if (result === null && input.updateStock) {
    const sign = document.document_type === 'credit_note' ? -1 : 1
    for (const item of normalizedItems) {
      if (item.product_id) await adjustLocalStock(item.product_id, sign * Number(item.quantity))
    }
  }
  return result
}

export async function getSupplierLedger(businessId: string, supplierId: string): Promise<SupplierLedgerMovement[]> {
  return cachedRead(`supplier_ledger:${supplierId}`, async () => {
    const { data, error } = await db.from('supplier_ledger').select('*').eq('business_id', businessId).eq('supplier_id', supplierId).order('occurred_at', { ascending: false })
    if (error) throw error
    return data ?? []
  })
}

export async function recordSupplierPayment(input: { businessId: string; supplierId: string; amount: string; date: string; paymentMethodId: string; purchaseId?: string; notes?: string }): Promise<string | null> {
  const amount = fromCents(toCents(input.amount))
  const allocations = input.purchaseId ? [{ purchase_id: input.purchaseId, amount }] : []
  return callRpcOrQueue<string>({
    business_id: input.businessId,
    rpc: 'record_supplier_payment',
    args: {
      p_supplier_id: input.supplierId,
      p_amount: amount,
      p_payment_date: input.date,
      p_payment_method_id: input.paymentMethodId,
      p_allocations: allocations,
      p_notes: input.notes || null,
    },
    label: 'Pago a proveedor',
    tables: ['purchases'],
    dedupe: {
      table: 'supplier_payments',
      match: { supplier_id: input.supplierId, amount, payment_date: input.date, payment_method_id: input.paymentMethodId },
    },
  })
}

export async function listVatSummary(businessId: string, from: string, to: string) {
  return cachedRead(`purchase_vat:${businessId}:${from}:${to}`, async () => {
    const { data, error } = await db.from('purchase_vat_summary').select('*').eq('business_id', businessId).gte('document_date', from).lte('document_date', to).order('document_date')
    if (error) throw error
    return data ?? []
  })
}

export async function saveConcept(businessId: string, concept: Partial<PurchaseConcept> & { name: string }) {
  const payload = { name: concept.name.trim(), code: concept.code?.trim().toUpperCase() || concept.name.trim().toUpperCase().replace(/\W+/g, '_'), active: concept.active ?? true, updated_at: new Date().toISOString() }
  if (concept.id) await syncEngine.updateRow('purchase_concepts', businessId, concept.id, payload)
  else await syncEngine.createRow('purchase_concepts', businessId, { ...payload, id: crypto.randomUUID() })
}

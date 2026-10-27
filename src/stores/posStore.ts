import { create } from 'zustand'
import type { CartItem, Product } from '@/types/database'
import { priceCart, type PricedLine, type Promotion } from '@/features/promotions/promotionEngine'
import { applyFreeUnit, type LoyaltyRedemption } from '@/features/loyalty/loyalty'

/** Renglones de venta: promociones y, si hay canje de producto gratis, una unidad bonificada. */
function computeSaleLines(items: CartItem[], promotions: Promotion[], redemption: LoyaltyRedemption | null): PricedLine[] {
  const lines = priceCart(items, promotions).lines
  if (redemption?.kind === 'product' && redemption.productId) {
    return applyFreeUnit(lines, redemption.productId, redemption.name) ?? lines
  }
  return lines
}

export type PaymentMethodType = 'cash' | 'debit' | 'credit' | 'transfer' | 'account' | 'qr'
export type ReceiptType = 'ticket' | 'A' | 'B' | 'C'

/** Mixed payment split entry */
export interface PaymentSplit {
  method: PaymentMethodType
  amount: number
}

interface POSState {
  items: CartItem[]
  discount: number
  paymentMethod: PaymentMethodType
  receiptType: ReceiptType
  installments: number
  surchargePct: number
  /** Payment method discount/surcharge percentage (from business settings) */
  pmDiscountPct: number
  customerId: string | null
  /** Mixed payments: when length > 0 it means multi-payment mode */
  paymentSplits: PaymentSplit[]
  /** Presupuesto que originó este carrito; al cobrar se lo marca como vendido. */
  sourceQuoteId: string | null
  /** Promociones vigentes del negocio (vacío si el plan no las incluye). */
  promotions: Promotion[]
  setPromotions: (promotions: Promotion[]) => void
  /** Renglones a vender con las promociones aplicadas (un ítem puede quedar en pagas + bonificadas). */
  getSaleLines: () => PricedLine[]
  getPromoDiscount: () => number
  /** El cliente elegido compra a precio mayorista. */
  wholesaleCustomer: boolean
  setWholesaleCustomer: (wholesale: boolean) => void
  /** Premio del club de puntos elegido para esta venta. */
  loyaltyRedemption: LoyaltyRedemption | null
  setLoyaltyRedemption: (redemption: LoyaltyRedemption | null) => void
  addItem: (product: Product, qty?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setDiscount: (discount: number) => void
  setPaymentMethod: (method: PaymentMethodType) => void
  setReceiptType: (type: ReceiptType) => void
  setInstallments: (n: number) => void
  setSurchargePct: (pct: number) => void
  setPmDiscountPct: (pct: number) => void
  setCustomerId: (id: string | null) => void
  setPaymentSplits: (splits: PaymentSplit[]) => void
  /** Reemplaza el carrito completo — usado al convertir un presupuesto en venta. */
  loadCart: (items: CartItem[], opts?: { discount?: number; customerId?: string | null; sourceQuoteId?: string | null }) => void
  getSubtotal: () => number
  getTotal: () => number
  clearCart: () => void
}

/**
 * Precio unitario de un producto en la venta: el mayorista se aplica al cliente mayorista o
 * cuando la cantidad llega al mínimo cargado en el producto.
 */
export function unitPrice(product: Product, quantity: number, wholesaleCustomer: boolean): number {
  const wholesale = Number((product as any).wholesale_price) || 0
  const minQty = Number((product as any).wholesale_min_qty) || 0
  if (wholesale > 0 && (wholesaleCustomer || (minQty > 0 && quantity >= minQty))) return wholesale
  return product.sale_price
}

/** Returns the default increment for a product based on its unit */
function getDefaultIncrement(product: Product): number {
  const unit = (product.unit || 'u') as string
  // For weight/length/volume units, default increment is 1 (kg/mts/lts)
  // The UI will allow decimal input for these
  return 1
}

/** Check if product uses decimal quantities */
export function isDecimalUnit(unit: string | undefined | null): boolean {
  return unit === 'kg' || unit === 'mts' || unit === 'lts'
}

/**
 * Tipo de comprobante preferido, recordado entre ventas.
 *
 * El default vivia fijo en 'ticket', asi que despues de cada venta habia que
 * volver a elegir Factura. Ahora se recuerda el ultimo usado.
 */
const RECEIPT_TYPE_KEY = 'stockia_receipt_type'

function loadReceiptType(): ReceiptType {
  try {
    const v = localStorage.getItem(RECEIPT_TYPE_KEY)
    if (v === 'ticket' || v === 'A' || v === 'B' || v === 'C') return v
  } catch {}
  return 'ticket'
}

function saveReceiptType(t: ReceiptType) {
  try { localStorage.setItem(RECEIPT_TYPE_KEY, t) } catch {}
}

export const usePOSStore = create<POSState>((set, get) => ({
  items: [],
  discount: 0,
  paymentMethod: 'cash',
  receiptType: loadReceiptType(),
  installments: 1,
  surchargePct: 0,
  pmDiscountPct: 0,
  customerId: null,
  paymentSplits: [],
  sourceQuoteId: null,
  promotions: [],
  wholesaleCustomer: false,

  setPromotions: (promotions) => set({ promotions }),
  setWholesaleCustomer: (wholesaleCustomer) => set({
    wholesaleCustomer,
    items: get().items.map((i) => ({ ...i, price: unitPrice(i.product, i.quantity, wholesaleCustomer) })),
  }),
  loyaltyRedemption: null,
  setLoyaltyRedemption: (loyaltyRedemption) => set({ loyaltyRedemption }),
  getSaleLines: () => computeSaleLines(get().items, get().promotions, get().loyaltyRedemption),
  getPromoDiscount: () => {
    const { items, promotions, loyaltyRedemption } = get()
    const list = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const charged = computeSaleLines(items, promotions, loyaltyRedemption).reduce((sum, line) => sum + line.price * line.quantity, 0)
    return Math.round((list - charged) * 100) / 100
  },

  addItem: (product: Product, qty?: number) => {
    const items = get().items
    const increment = qty ?? getDefaultIncrement(product)
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      const newQty = existing.quantity + increment
      if (newQty > product.stock) return
      set({
        items: items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.round(newQty * 1000) / 1000, price: unitPrice(product, newQty, get().wholesaleCustomer) }
            : i
        ),
      })
    } else {
      if (product.stock < increment) return
      set({ items: [...items, { product, quantity: increment, price: unitPrice(product, increment, get().wholesaleCustomer) }] })
    }
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) })
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    const item = get().items.find((i) => i.product.id === productId)
    if (item && quantity > item.product.stock) return
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity: Math.round(quantity * 1000) / 1000, price: unitPrice(i.product, quantity, get().wholesaleCustomer) } : i
      ),
    })
  },

  setDiscount: (discount: number) => set({ discount: Math.max(0, Math.min(100, discount)) }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod, installments: paymentMethod === 'credit' ? 1 : 1, surchargePct: paymentMethod === 'credit' ? 0 : 0 }),
  setReceiptType: (receiptType) => { saveReceiptType(receiptType); set({ receiptType }) },
  setInstallments: (installments) => set({ installments }),
  setSurchargePct: (surchargePct) => set({ surchargePct }),
  setPmDiscountPct: (pmDiscountPct) => set({ pmDiscountPct }),
  setCustomerId: (customerId) => set({ customerId }),
  setPaymentSplits: (paymentSplits) => set({ paymentSplits }),

  // Subtotal ya con promociones: sobre él se aplican descuento manual, recargo y medio de pago.
  getSubtotal: () => {
    const lines = computeSaleLines(get().items, get().promotions, get().loyaltyRedemption)
    return Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100
  },

  getTotal: () => {
    const subtotal = get().getSubtotal()
    const discount = get().discount
    const afterDiscount = subtotal - (subtotal * discount) / 100
    const surcharge = get().surchargePct
    const afterSurcharge = afterDiscount + (afterDiscount * surcharge) / 100
    // Apply payment method discount (always positive = discount percentage)
    const pmPct = get().pmDiscountPct
    const afterPm = afterSurcharge - (afterSurcharge * pmPct) / 100
    return Math.round(afterPm * 100) / 100
  },

  loadCart: (items, opts) => set({
    items,
    discount: opts?.discount ?? 0,
    customerId: opts?.customerId ?? null,
    paymentMethod: 'cash',
    receiptType: loadReceiptType(),
    installments: 1,
    surchargePct: 0,
    pmDiscountPct: 0,
    paymentSplits: [],
    sourceQuoteId: opts?.sourceQuoteId ?? null,
    loyaltyRedemption: null,
  }),

  clearCart: () => set({ items: [], wholesaleCustomer: false, discount: 0, customerId: null, paymentMethod: 'cash', receiptType: loadReceiptType(), installments: 1, surchargePct: 0, pmDiscountPct: 0, paymentSplits: [], sourceQuoteId: null, loyaltyRedemption: null }),
}))

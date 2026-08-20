import { create } from 'zustand'
import type { CartItem, Product } from '@/types/database'

export type PaymentMethodType = 'cash' | 'debit' | 'credit' | 'transfer' | 'account'
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
            ? { ...i, quantity: Math.round(newQty * 1000) / 1000 }
            : i
        ),
      })
    } else {
      if (product.stock < increment) return
      set({ items: [...items, { product, quantity: increment, price: product.sale_price }] })
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
        i.product.id === productId ? { ...i, quantity: Math.round(quantity * 1000) / 1000 } : i
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

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
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
  }),

  clearCart: () => set({ items: [], discount: 0, customerId: null, paymentMethod: 'cash', receiptType: loadReceiptType(), installments: 1, surchargePct: 0, pmDiscountPct: 0, paymentSplits: [], sourceQuoteId: null }),
}))

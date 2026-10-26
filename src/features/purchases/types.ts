export interface Supplier {
  id: string
  name: string
  legal_name: string | null
  trade_name: string | null
  cuit: string | null
  vat_condition: string | null
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseConcept { id: string; code: string; name: string; active: boolean }
export interface TaxType { id: string; code: string; name: string; rate: number | null; kind: 'vat' | 'perception' | 'withholding' | 'other'; active: boolean }
export interface PaymentMethod { id: string; code: string; name: string; affects_cash: boolean; affects_bank: boolean }

export interface PurchaseDocument {
  id: string
  supplier_id: string
  document_type: string
  letter: string | null
  point_of_sale: number | null
  document_number: number | null
  document_date: string
  due_date: string | null
  total: number
  balance_due: number
  status: string
  is_fiscal: boolean
  supplier: Pick<Supplier, 'id' | 'name' | 'legal_name' | 'cuit'> | null
  purchase_items?: Array<{ id: string; description: string | null; quantity: number; unit_cost: number; subtotal: number; vat_rate: number; vat_amount: number; total: number }>
}

export interface PurchaseDraftItem {
  product_id?: string
  concept_id?: string
  description: string
  quantity: string
  unit_cost: string
  vat_rate: string
}

export interface SupplierLedgerMovement {
  id: string
  occurred_at: string
  movement_type: string
  debit: number
  credit: number
  description: string | null
}

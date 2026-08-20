/**
 * AFIP Service – Client-side helper to call the Supabase Edge Functions
 * for electronic invoicing (WSAA + WSFEv1).
 *
 * Architecture:
 * 1. Frontend calls requestCAE() with invoice data
 * 2. requestCAE() creates a draft invoice in DB
 * 3. Calls Edge Function "afip-authorize-invoice" which:
 *    a. Reads fiscal_keys (encrypted private key + CRT)
 *    b. Calls billing-service for WSAA auth + WSFEv1
 *    c. Gets CAE, generates PDF, stores in Supabase Storage
 *    d. Updates invoice record with CAE + authorized status
 * 4. Returns CAE result to frontend
 *
 * Fallback: if Edge Function not deployed, uses local mock.
 */

import { supabase } from '@/lib/supabase'
import { CBTE_TIPOS, IVA_RATE } from '@/types/database'
import type { CartItem } from '@/types/database'

/* ---- Types ---- */
export interface AFIPInvoiceRequest {
  /** 'A' | 'B' | 'C' */
  invoiceType: string
  /** AFIP punto de venta */
  puntoVenta: number
  /** Customer doc tipo (80=CUIT, 86=CUIL, 96=DNI, 99=Sin) */
  docTipo: number
  docNro: string
  /** Total sale amount */
  total: number
  /** Items for IVA breakdown */
  items: CartItem[]
  /** Discount percentage */
  discount: number
  /** Surcharge percentage (cuotas) */
  surcharge: number
  /** IVA condition of the business */
  businessIvaCondition: string
  /** Environment override (homo/prod) */
  env?: 'homo' | 'prod'
  /** Venta que origina el comprobante — necesaria para crear el borrador */
  saleId?: string
  businessId?: string
  customerName?: string
  customerIvaCondition?: string
}

export interface AFIPInvoiceResult {
  success: boolean
  cae?: string
  caeExpiry?: string
  cbteNro?: number
  cbteTipo?: number
  netoGravado?: number
  netoNoGravado?: number
  ivaAmount?: number
  exento?: number
  error?: string
  /** PDF URL from Supabase Storage */
  pdfUrl?: string
  /** Raw request/response for audit */
  request?: string
  response?: string
  /** Id del comprobante creado, para vincular los items */
  invoiceId?: string
}

/**
 * Get the AFIP cbte_tipo number from invoice letter + document type
 */
export function getCbteTipo(invoiceType: string, isNotaCredito = false): number {
  if (invoiceType === 'A') return isNotaCredito ? CBTE_TIPOS.nota_credito_a : CBTE_TIPOS.factura_a
  if (invoiceType === 'B') return isNotaCredito ? CBTE_TIPOS.nota_credito_b : CBTE_TIPOS.factura_b
  return isNotaCredito ? CBTE_TIPOS.nota_credito_c : CBTE_TIPOS.factura_c
}

/**
 * Calculate IVA breakdown from items for Factura A (RI → RI)
 * Factura A discriminates IVA. B and C don't.
 */
export function calculateIVA(invoiceType: string, items: CartItem[], discount: number, surcharge: number) {
  const subtotalBruto = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const afterDiscount = subtotalBruto - (subtotalBruto * discount) / 100
  const afterSurcharge = afterDiscount + (afterDiscount * surcharge) / 100
  const total = Math.round(afterSurcharge * 100) / 100

  if (invoiceType === 'A') {
    // Factura A: prices INCLUDE IVA, so we need to extract it
    const netoGravado = Math.round((total / (1 + IVA_RATE)) * 100) / 100
    const ivaAmount = Math.round((total - netoGravado) * 100) / 100
    return {
      netoGravado,
      netoNoGravado: 0,
      exento: 0,
      ivaAmount,
      total,
    }
  }

  // Factura B or C: No IVA discrimination
  return {
    netoGravado: total,
    netoNoGravado: 0,
    exento: 0,
    ivaAmount: 0,
    total,
  }
}

/**
 * Request a CAE from AFIP.
 *
 * Flow:
 * 1. Try Edge Function "afip-authorize-invoice" (production-ready with billing-service)
 * 2. Fallback to legacy Edge Function "afip-invoice" (simple mock)
 * 3. Final fallback to local mock for development
 */
export async function requestCAE(req: AFIPInvoiceRequest): Promise<AFIPInvoiceResult> {
  const cbteTipo = getCbteTipo(req.invoiceType)
  const iva = calculateIVA(req.invoiceType, req.items, req.discount, req.surcharge)

  // El flujo real es en dos pasos: se crea la factura en borrador y despues se
  // autoriza contra AFIP con su id. Antes se llamaba a una Edge Function
  // 'afip-invoice' que no existe desplegada, asi que siempre fallaba y se caia
  // al CAE simulado.
  if (!req.saleId || !req.businessId) {
    return { success: false, error: 'Faltan datos de la venta para emitir la factura.' }
  }

  try {
    const env = req.env || 'homo'

    const { data: draft, error: draftError } = await supabase
      .from('invoices')
      .insert({
        sale_id: req.saleId,
        business_id: req.businessId,
        invoice_type: req.invoiceType,
        cbte_tipo: cbteTipo,
        invoice_number: 0,
        punto_venta: req.puntoVenta,
        doc_tipo: req.docTipo,
        doc_nro: req.docNro,
        customer_name: req.customerName || 'Consumidor Final',
        iva_condition_customer: req.customerIvaCondition || 'consumidor_final',
        neto_gravado: iva.netoGravado,
        neto_no_gravado: iva.netoNoGravado,
        exento: iva.exento,
        iva_amount: iva.ivaAmount,
        total: iva.total,
        status: 'draft',
        env,
      } as any)
      .select('id')
      .single()

    if (draftError || !draft) {
      return { success: false, error: draftError?.message || 'No se pudo registrar el comprobante.' }
    }

    const result = await authorizeInvoice((draft as any).id)

    // AFIP rechazo o no respondio: el borrador no sirve para nada y ensuciaria
    // el listado de comprobantes.
    if (!result.success) {
      await supabase.from('invoices').delete().eq('id', (draft as any).id)
      return result
    }

    return { ...result, cbteTipo, ...iva, invoiceId: (draft as any).id }
  } catch (err: any) {
    console.error('AFIP error:', err)
    return {
      success: false,
      error: err?.message || 'No se pudo conectar con AFIP. Verificá la configuración en Ajustes → Facturación AFIP.',
    }
  }
}

/**
 * Authorize an existing draft invoice via the Edge Function.
 * This is the main production flow called from POS.
 */
export async function authorizeInvoice(invoiceId: string): Promise<AFIPInvoiceResult> {
  try {
    const { data, error } = await supabase.functions.invoke('afip-authorize-invoice', {
      body: { invoice_id: invoiceId },
    })

    if (error) {
      console.warn('Authorize invoice edge function error:', error)
      return { success: false, error: error.message || 'Edge Function error' }
    }

    if (data?.error) {
      return { success: false, error: data.error }
    }

    return {
      success: true,
      cae: data.cae,
      caeExpiry: data.cae_vto,
      cbteNro: data.cbte_nro,
      pdfUrl: data.pdf_url,
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al autorizar factura' }
  }
}

/**
 * Antes esto devolvia un CAE inventado cuando AFIP no respondia, y la venta
 * seguia como si estuviera autorizada: se entregaban facturas sin validez
 * fiscal y sin declarar. Ahora falla de forma explicita para que el POS
 * ofrezca el recibo no fiscal en su lugar.
 */
async function generateLocalFallback(
  _cbteTipo: number,
  _iva: ReturnType<typeof calculateIVA>,
  _puntoVenta: number,
): Promise<AFIPInvoiceResult> {
  return {
    success: false,
    error: 'No se pudo conectar con AFIP. Verificá la configuración en Ajustes → Facturación AFIP, o emití un recibo no fiscal.',
  }
}

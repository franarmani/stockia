import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { usePOSStore, isDecimalUnit, type PaymentMethodType, type ReceiptType, type PaymentSplit } from '@/stores/posStore'
import { useFiscalStore } from '@/stores/fiscalStore'
import { formatCurrency } from '@/lib/utils'
import { UNIT_SHORT, DOC_TIPOS, IVA_CONDITIONS, type ProductUnit } from '@/types/database'
import { requestCAE, calculateIVA, getCbteTipo } from '@/lib/afipService'
import { queueSale } from '@/lib/offlineQueue'
import { syncProductsCache, getCachedProducts, findCachedProductByBarcode, updateCachedStock } from '@/lib/offlineProductsCache'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import PostSaleModal, { type PostSaleData } from '@/components/PostSaleModal'
import type { Product, Customer, CartItem } from '@/types/database'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, ArrowRightLeft, X, CheckCircle2, User, Wallet,
  FileText, Receipt, Percent, CircleDollarSign, Camera, ChevronRight, Check,
} from 'lucide-react'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 1200; gain.gain.value = 0.1
    osc.start(); osc.stop(ctx.currentTime + 0.08)
  } catch { /* ignore */ }
}

function getUnitLabel(product: Product): string {
  return UNIT_SHORT[(product.unit || 'u') as ProductUnit] || 'uds'
}

const PAYMENT_METHODS: { id: PaymentMethodType; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'debit', label: 'Débito', icon: CreditCard },
  { id: 'credit', label: 'Crédito', icon: CreditCard },
  { id: 'transfer', label: 'Transfer.', icon: ArrowRightLeft },
  { id: 'account', label: 'Cta. Cte.', icon: CircleDollarSign },
]

const RECEIPT_TYPES: { id: ReceiptType; label: string; desc: string }[] = [
  { id: 'ticket', label: 'Ticket', desc: 'Sin factura' },
  { id: 'A', label: 'Factura A', desc: 'Resp. Inscripto' },
  { id: 'B', label: 'Factura B', desc: 'Consumidor Final' },
  { id: 'C', label: 'Factura C', desc: 'Monotributo' },
]

const CUOTA_OPTIONS = [
  { n: 1, label: '1 pago', surcharge: 0 },
  { n: 3, label: '3 cuotas', surcharge: 15 },
  { n: 6, label: '6 cuotas', surcharge: 25 },
  { n: 12, label: '12 cuotas', surcharge: 40 },
]

const PAYMENT_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Efectivo', debit: 'Tarjeta Débito', credit: 'Tarjeta Crédito',
  transfer: 'Transferencia', account: 'Cuenta Corriente',
}

export default function POSPage() {
  const { profile } = useAuthStore()
  const {
    items, discount, paymentMethod, customerId,
    receiptType, installments, surchargePct, pmDiscountPct, paymentSplits,
    addItem, removeItem, updateQuantity, setDiscount,
    setPaymentMethod, setCustomerId, getSubtotal, getTotal, clearCart,
    setReceiptType, setInstallments, setSurchargePct, setPmDiscountPct, setPaymentSplits,
  } = usePOSStore()

  const { business } = useBusinessStore()
  const fiscalCertStatus = useFiscalStore((s) => s.settings?.cert_status)
  const isFiscalConnected = fiscalCertStatus === 'connected'
  const fiscalEnv = useFiscalStore((s) => s.env)

  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [cajaOpen, setCajaOpen] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<string | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [mixedPaymentMode, setMixedPaymentMode] = useState(false)
  const [mixedSplits, setMixedSplits] = useState<PaymentSplit[]>([
    { method: 'cash', amount: 0 },
    { method: 'debit', amount: 0 },
  ])
  // Customer doc for facturas
  const [docTipoCustomer, setDocTipoCustomer] = useState('99')
  const [docNroCustomer, setDocNroCustomer] = useState('')
  // Quantity input modal for decimal unit products
  const [qtyInputProduct, setQtyInputProduct] = useState<Product | null>(null)
  const [qtyInputValue, setQtyInputValue] = useState('')
  const [postSaleData, setPostSaleData] = useState<PostSaleData | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cameraContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.business_id) { fetchProducts(); fetchCustomers(); checkCajaOpen() }
  }, [profile?.business_id])

  useEffect(() => { searchRef.current?.focus() }, [])

  // USB barcode scanner
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 6) {
        const code = barcodeBuffer.current
        barcodeBuffer.current = ''
        handleBarcodeScanned(code)
        return
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        clearTimeout(barcodeTimer.current)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = '' }, 100)
      }
    }
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [products])

  const handleBarcodeScanned = useCallback((code: string) => {
    const product = products.find(p => p.barcode === code)
    if (product) {
      if (isDecimalUnit(product.unit)) {
        setQtyInputProduct(product)
        setQtyInputValue('1')
      } else {
        addItem(product)
        playBeep()
        toast.success(`${product.name} agregado`)
      }
    } else {
      toast.error(`Producto no encontrado: ${code}`)
    }
  }, [products, addItem])

  // Camera barcode scanning
  async function startCameraScanner() {
    setShowCameraScanner(true)
    const { Html5Qrcode } = await import('html5-qrcode')
    setTimeout(() => {
      const scanner = new Html5Qrcode('camera-scanner-region')
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          scanner.stop().catch(() => {})
          setShowCameraScanner(false)
          handleBarcodeScanned(decodedText)
        },
        () => {}
      ).catch(() => {
        toast.error('No se pudo acceder a la cámara')
        setShowCameraScanner(false)
      })
      ;(window as any).__nexoScanner = scanner
    }, 300)
  }

  function stopCameraScanner() {
    const scanner = (window as any).__nexoScanner
    if (scanner) { scanner.stop().catch(() => {}); delete (window as any).__nexoScanner }
    setShowCameraScanner(false)
  }

  async function fetchProducts() {
    if (!navigator.onLine) {
      // Use cached products when offline
      const cached = await getCachedProducts(profile!.business_id)
      if (cached.length > 0) {
        setProducts(cached as Product[])
        toast.info(`Modo offline: ${cached.length} productos cargados desde caché`)
        return
      }
    }
    const { data } = await supabase.from('products').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name')
    setProducts(data || [])
    // Sync products cache for offline use
    if (data && data.length > 0) {
      syncProductsCache(profile!.business_id).catch(() => {})
    }
  }
  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').eq('business_id', profile!.business_id).order('name')
    setCustomers(data || [])
  }
  async function checkCajaOpen() {
    const { data } = await supabase.from('cash_sessions').select('id').eq('business_id', profile!.business_id).is('closed_at', null).limit(1)
    setCajaOpen(!!(data && data.length > 0))
  }

  const filteredProducts = products.filter((p) => {
    if (!search) return false
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q))
  })

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && search.trim()) {
      const exactMatch = products.find(p => p.barcode === search.trim())
      if (exactMatch) { handleProductClick(exactMatch); setSearch(''); return }
      if (filteredProducts.length === 1) { handleProductClick(filteredProducts[0]); setSearch('') }
    }
  }

  function handleProductClick(product: Product) {
    if (isDecimalUnit(product.unit)) {
      setQtyInputProduct(product)
      setQtyInputValue('1')
    } else {
      addItem(product)
      playBeep()
      searchRef.current?.focus()
    }
  }

  function handleConfirmQtyInput() {
    if (!qtyInputProduct) return
    const qty = parseFloat(qtyInputValue)
    if (!qty || qty <= 0) { toast.error('Cantidad inválida'); return }
    if (qty > qtyInputProduct.stock) { toast.error('Stock insuficiente'); return }
    addItem(qtyInputProduct, qty)
    playBeep()
    toast.success(`${qtyInputProduct.name} — ${qty} ${getUnitLabel(qtyInputProduct)} agregado`)
    setQtyInputProduct(null)
    setQtyInputValue('')
    searchRef.current?.focus()
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)

  function handleSelectCuota(opt: typeof CUOTA_OPTIONS[number]) {
    setInstallments(opt.n)
    setSurchargePct(opt.surcharge)
  }

  // Apply payment method discount/surcharge from business settings
  function handleSelectPaymentMethod(method: PaymentMethodType) {
    setPaymentMethod(method)
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    const pct = discounts?.[method] ?? 0
    setPmDiscountPct(pct)
  }

  // Sync pmDiscountPct on mount with current payment method
  useEffect(() => {
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    const pct = discounts?.[paymentMethod] ?? 0
    setPmDiscountPct(pct)
  }, [business])

  // Mixed payment helpers
  function addMixedSplit() {
    setMixedSplits([...mixedSplits, { method: 'cash', amount: 0 }])
  }
  function updateMixedSplit(index: number, field: 'method' | 'amount', value: string) {
    setMixedSplits(mixedSplits.map((s, i) => i === index ? { ...s, [field]: field === 'amount' ? Number(value) : value } : s))
  }
  function removeMixedSplit(index: number) {
    if (mixedSplits.length <= 2) return
    setMixedSplits(mixedSplits.filter((_, i) => i !== index))
  }
  const mixedTotal = mixedSplits.reduce((s, sp) => s + sp.amount, 0)
  const mixedRemaining = getTotal() - mixedTotal

  async function handleConfirmSale() {
    if (items.length === 0) return
    if (paymentMethod === 'account' && !customerId && !mixedPaymentMode) {
      toast.error('Seleccioná un cliente para Cuenta Corriente'); return
    }
    if (receiptType !== 'ticket' && !isFiscalConnected) {
      toast.error('AFIP no está configurado. Andá a Configuración → Facturación AFIP para completar el wizard.'); return
    }
    if (receiptType === 'A' && !docNroCustomer.trim()) {
      toast.error('Ingresá el CUIT del cliente para Factura A'); return
    }
    if (mixedPaymentMode && Math.abs(mixedRemaining) > 0.01) {
      toast.error('Los montos del pago mixto no coinciden con el total'); return
    }
    setProcessing(true)
    try {
      const total = getTotal()
      const primaryPayment = mixedPaymentMode ? 'mixed' : paymentMethod

      // ---- OFFLINE FALLBACK ----
      if (!navigator.onLine) {
        if (receiptType !== 'ticket') {
          toast.error('Sin conexión: solo se pueden hacer ventas con Ticket (sin factura)')
          setProcessing(false); return
        }
        const offlineId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const subtotalRaw = items.reduce((s, i) => s + i.price * i.quantity, 0)
        const afterDiscount = subtotalRaw - (subtotalRaw * discount) / 100
        const surchargeAmt = (afterDiscount * surchargePct) / 100
        const stockUpdates = items.map(item => ({
          productId: item.product.id,
          newStock: Math.round((item.product.stock - item.quantity) * 1000) / 1000,
          qty: item.quantity,
        }))
        const accountAmount = mixedPaymentMode
          ? (mixedSplits.find(s => s.method === 'account')?.amount || 0)
          : (paymentMethod === 'account' ? total : 0)
        await queueSale({
          id: offlineId,
          createdAt: new Date().toISOString(),
          payload: {
            sale: {
              business_id: profile!.business_id,
              customer_id: customerId,
              total,
              discount,
              payment_method: primaryPayment,
              seller_id: profile!.id,
              receipt_type: receiptType,
              installments,
              surcharge_pct: surchargePct,
            },
            items: items.map(item => ({
              product_id: item.product.id,
              quantity: item.quantity,
              price: item.price,
              cost_at_sale: item.product.avg_cost || item.product.purchase_price || 0,
            })),
            payments: mixedPaymentMode
              ? mixedSplits.filter(s => s.amount > 0).map(s => ({ payment_method: s.method, amount: s.amount }))
              : [{ payment_method: paymentMethod, amount: total }],
            stockUpdates,
            accountUpdate: accountAmount > 0 && customerId ? { customerId, amount: accountAmount } : undefined,
          },
        })

        const business = useBusinessStore.getState().business
        setPostSaleData({
          businessName: business?.name || 'Mi Negocio',
          businessAddress: business?.address,
          businessPhone: business?.phone,
          businessCuit: business?.cuit,
          receiptType: 'ticket',
          items: [...items],
          subtotal: subtotalRaw,
          discount,
          surcharge: surchargeAmt,
          surchargeAmount: surchargeAmt,
          total,
          paymentMethod: primaryPayment,
          installments,
          customerName: selectedCustomer?.name || '',
          sellerName: profile?.name || '',
          footer: business?.receipt_footer,
          date: new Date(),
          paymentSplits: mixedPaymentMode ? mixedSplits.filter(s => s.amount > 0) : undefined,
          logoUrl: business?.logo_url,
          primaryColor: business?.primary_color || '#1DB954',
          autoPrint: business?.auto_print || false,
        })

        // Update cached product stock for offline consistency
        for (const item of items) {
          const newStock = Math.round((item.product.stock - item.quantity) * 1000) / 1000
          updateCachedStock(item.product.id, Math.max(0, newStock)).catch(() => {})
        }

        clearCart(); setShowConfirmModal(false); setShowSuccess(true); setShowTicketModal(true)
        setMixedPaymentMode(false); setMixedSplits([{ method: 'cash', amount: 0 }, { method: 'debit', amount: 0 }])
        toast.success('Venta guardada offline — se sincronizará al reconectar')
        playBeep()
        setTimeout(() => setShowSuccess(false), 2500)
        setProcessing(false)
        return
      }

      // ---- ONLINE FLOW ----
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: profile!.business_id,
          customer_id: customerId,
          total,
          discount,
          payment_method: primaryPayment,
          seller_id: profile!.id,
          receipt_type: receiptType,
          installments,
          surcharge_pct: surchargePct,
        })
        .select().single()

      if (saleError || !sale) { toast.error('Error al crear la venta'); setProcessing(false); return }

      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.price,
        cost_at_sale: item.product.avg_cost || item.product.purchase_price || 0,
      }))
      await supabase.from('sale_items').insert(saleItems)

      // Insert payment splits
      if (mixedPaymentMode) {
        const splits = mixedSplits.filter(s => s.amount > 0)
        await supabase.from('sale_payments').insert(
          splits.map(s => ({ sale_id: sale.id, payment_method: s.method, amount: s.amount }))
        )
      } else {
        await supabase.from('sale_payments').insert([
          { sale_id: sale.id, payment_method: paymentMethod, amount: total }
        ])
      }

      for (const item of items) {
        const newStock = Math.round((item.product.stock - item.quantity) * 1000) / 1000
        await supabase.from('products').update({ stock: Math.max(0, newStock) }).eq('id', item.product.id)
        await supabase.from('stock_movements').insert({
          business_id: profile!.business_id,
          product_id: item.product.id,
          type: 'sale',
          quantity: -item.quantity,
          reference_id: sale.id,
        })
      }

      if (!mixedPaymentMode && paymentMethod === 'account' && customerId) {
        const customer = customers.find((c) => c.id === customerId)
        if (customer) await supabase.from('customers').update({ balance: customer.balance + total }).eq('id', customerId)
      }
      if (mixedPaymentMode) {
        const accountSplit = mixedSplits.find(s => s.method === 'account' && s.amount > 0)
        if (accountSplit && customerId) {
          const customer = customers.find((c) => c.id === customerId)
          if (customer) await supabase.from('customers').update({ balance: customer.balance + accountSplit.amount }).eq('id', customerId)
        }
      }

      setLastSaleId(sale.id)

      // ----- AFIP Invoice creation -----
      let invoiceCae: string | null = null
      let invoiceCaeExpiry: string | null = null
      let invoiceNumber: number | undefined
      let puntoVenta: number | undefined
      let netoGravado: number | undefined
      let ivaAmount: number | undefined

      const business = useBusinessStore.getState().business
      if (receiptType !== 'ticket' && business) {
        const pv = business.punto_venta || 1
        const docTipoNum = Number(docTipoCustomer) || 99
        const docNro = docNroCustomer.replace(/[^0-9]/g, '') || '0'

        try {
          const caeResult = await requestCAE({
            invoiceType: receiptType,
            puntoVenta: pv,
            docTipo: docTipoNum,
            docNro: docNro,
            total,
            items: [...items],
            discount,
            surcharge: surchargePct,
            businessIvaCondition: business.iva_condition || 'monotributo',
          })

          if (caeResult.success) {
            invoiceCae = caeResult.cae || null
            invoiceCaeExpiry = caeResult.caeExpiry || null
            invoiceNumber = caeResult.cbteNro
            puntoVenta = pv
            netoGravado = caeResult.netoGravado
            ivaAmount = caeResult.ivaAmount

            const cbteTipo = getCbteTipo(receiptType)
            const { data: invoiceData } = await supabase.from('invoices').insert({
              sale_id: sale.id,
              business_id: profile!.business_id,
              invoice_type: receiptType,
              cbte_tipo: cbteTipo,
              invoice_number: caeResult.cbteNro || 0,
              punto_venta: pv,
              doc_tipo: docTipoNum,
              doc_nro: docNro,
              customer_name: selectedCustomer?.name || 'Consumidor Final',
              iva_condition_customer: selectedCustomer ? (selectedCustomer as any).iva_condition : 'consumidor_final',
              customer_address: selectedCustomer ? (selectedCustomer as any).address : null,
              neto_gravado: caeResult.netoGravado || 0,
              neto_no_gravado: caeResult.netoNoGravado || 0,
              exento: caeResult.exento || 0,
              iva_amount: caeResult.ivaAmount || 0,
              total,
              cae: caeResult.cae,
              cae_expiry: caeResult.caeExpiry,
              afip_request: caeResult.request,
              afip_response: caeResult.response,
              status: 'authorized',
              env: fiscalEnv,
            }).select().single()

            // Insert invoice_items for detailed fiscal record
            if (invoiceData) {
              const invoiceItemsData = items.map(item => {
                const unitPrice = item.price
                const itemTotal = unitPrice * item.quantity
                const discountedTotal = itemTotal - (itemTotal * discount / 100)
                const surchargedTotal = discountedTotal + (discountedTotal * surchargePct / 100)
                const iva = business.iva_condition === 'responsable_inscripto'
                  ? Math.round((surchargedTotal / 1.21) * 0.21 * 100) / 100
                  : 0
                const netoItem = business.iva_condition === 'responsable_inscripto'
                  ? Math.round((surchargedTotal / 1.21) * 100) / 100
                  : surchargedTotal
                return {
                  invoice_id: invoiceData.id,
                  product_id: item.product.id,
                  description: item.product.name,
                  qty: item.quantity,
                  unit_price: unitPrice,
                  iva_rate: business.iva_condition === 'responsable_inscripto' ? 21 : 0,
                  total: surchargedTotal,
                }
              })
              await supabase.from('invoice_items').insert(invoiceItemsData)
            }

            toast.success(`Factura ${receiptType} autorizada — CAE: ${caeResult.cae}`)
          } else {
            toast.warning('Venta registrada pero sin CAE: ' + (caeResult.error || 'Error AFIP'))
          }
        } catch (err) {
          console.error('AFIP error:', err)
          toast.warning('Venta registrada. Error al solicitar CAE.')
        }
      }

      const subtotalRaw = items.reduce((s, i) => s + i.price * i.quantity, 0)
      const afterDiscount = subtotalRaw - (subtotalRaw * discount) / 100
      const surchargeAmt = (afterDiscount * surchargePct) / 100
      setPostSaleData({
        businessName: business?.name || 'Mi Negocio',
        businessAddress: business?.address,
        businessPhone: business?.phone,
        businessCuit: business?.cuit,
        ivaCondition: business?.iva_condition,
        iibb: business?.iibb,
        razonSocial: business?.razon_social,
        domicilioComercial: business?.domicilio_comercial,
        inicioActividades: business?.inicio_actividades,
        receiptType,
        items: [...items],
        subtotal: subtotalRaw,
        discount,
        surcharge: surchargeAmt,
        surchargeAmount: surchargeAmt,
        total,
        paymentMethod: mixedPaymentMode ? 'mixed' : paymentMethod,
        installments,
        customerName: selectedCustomer?.name || '',
        customerDocTipo: Number(docTipoCustomer) || 99,
        customerDocNro: docNroCustomer || undefined,
        customerIvaCondition: selectedCustomer ? (selectedCustomer as any).iva_condition : undefined,
        customerPhone: selectedCustomer?.phone || undefined,
        sellerName: profile?.name || '',
        footer: business?.receipt_footer,
        date: new Date(),
        paymentSplits: mixedPaymentMode ? mixedSplits.filter(s => s.amount > 0) : undefined,
        cae: invoiceCae,
        caeExpiry: invoiceCaeExpiry,
        invoiceNumber,
        puntoVenta,
        netoGravado,
        ivaAmount,
        logoUrl: business?.logo_url,
        primaryColor: business?.primary_color || '#1DB954',
        autoPrint: business?.auto_print || false,
      })

      clearCart(); setDocNroCustomer(''); setDocTipoCustomer('99'); setShowConfirmModal(false); setShowSuccess(true); setShowTicketModal(true)
      setMixedPaymentMode(false); setMixedSplits([{ method: 'cash', amount: 0 }, { method: 'debit', amount: 0 }])
      playBeep(); fetchProducts()
      setTimeout(() => setShowSuccess(false), 2500)
    } catch { toast.error('Error inesperado') } finally { setProcessing(false) }
  }

  const cartContent = (
    <div className="flex flex-col h-full">

      {/* Cart header */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/25 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-[15px]">Carrito</span>
                {items.length > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-sm shadow-primary/40">
                    {items.length}
                  </span>
                )}
              </div>
              {items.length > 0 && (
                <p className="text-[10px] text-white/35">{formatCurrency(getTotal())} total</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] font-semibold text-white/30 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10"
              >
                Vaciar
              </button>
            )}
            <button onClick={() => setShowCart(false)} className="lg:hidden w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center hover:bg-white/15 transition">
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
        </div>

        {/* Customer selector */}
        <button
          onClick={() => setShowCustomerModal(true)}
          className={`flex items-center gap-2.5 w-full py-2 px-3 rounded-xl border transition-all ${
            selectedCustomer
              ? 'border-primary/30 bg-primary/10 text-white'
              : 'border-white/10 bg-white/4 text-white/45 hover:border-white/20 hover:bg-white/7 hover:text-white/70'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
            selectedCustomer ? 'bg-primary/25 text-primary' : 'bg-white/8 text-white/35'
          }`}>
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="truncate flex-1 text-left text-[12px] font-medium">
            {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
          </span>
          {selectedCustomer ? (
            <span
              onClick={(e) => { e.stopPropagation(); setCustomerId(null) }}
              className="text-white/30 hover:text-red-400 transition p-0.5"
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronRight className="w-3 h-3 text-white/20" />
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/8 mx-4" />

      {/* Cart items */}
      <div className="flex-1 overflow-auto px-3 py-2.5 space-y-1.5 min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/25 py-8 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/35">Carrito vacío</p>
              <p className="text-xs text-white/20 mt-0.5">Buscá y agregá productos</p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const decimal = isDecimalUnit(item.product.unit)
            const unit = getUnitLabel(item.product)
            return (
              <div key={item.product.id} className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl px-3 py-2 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate leading-tight">{item.product.name}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {formatCurrency(item.price)}/{unit}
                    {item.product.brand && <span className="ml-1 opacity-70">· {item.product.brand}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {decimal ? (
                    <>
                      <input
                        type="number" step="0.1" min="0.01"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-center text-sm font-bold rounded-lg bg-white/10 border border-white/15 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <span className="text-[10px] text-white/40">{unit}</span>
                    </>
                  ) : (
                    <>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 active:scale-90 transition text-white/60">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-[13px] font-bold text-white tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center hover:bg-primary/20 hover:border-primary/30 hover:text-primary active:scale-90 transition text-white/60">
                        <Plus className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <span className="text-[13px] font-bold text-white tabular-nums shrink-0 min-w-[52px] text-right">
                  {formatCurrency(item.price * item.quantity)}
                </span>
                <button onClick={() => removeItem(item.product.id)} className="shrink-0 text-white/20 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Cart footer */}
      <div className="border-t border-white/8 px-3 pt-3 pb-3 space-y-2.5 shrink-0">
        {!mixedPaymentMode && (
          <div className="grid grid-cols-5 gap-1.5">
            {PAYMENT_METHODS.map((pm) => {
              const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
              const pmPct = discounts?.[pm.id] ?? 0
              return (
              <button key={pm.id} onClick={() => handleSelectPaymentMethod(pm.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold border-2 transition-all active:scale-95 ${
                  paymentMethod === pm.id
                    ? 'border-primary bg-primary/20 text-primary shadow-md shadow-primary/20'
                    : 'border-white/8 bg-white/4 text-white/40 hover:border-white/20 hover:bg-white/8 hover:text-white/70'
                }`}>
                <pm.icon className="w-4 h-4" />
                {pm.label}
                {pmPct > 0 && (
                  <span className="text-[8px] font-bold text-green-400">
                    -{pmPct}%
                  </span>
                )}
              </button>
              )
            })}
          </div>
        )}

        {/* Mixed payment toggle */}
        <button
          onClick={() => setMixedPaymentMode(!mixedPaymentMode)}
          className={`w-full text-xs font-semibold py-1.5 rounded-xl border transition-all ${
            mixedPaymentMode
              ? 'border-blue-400/60 bg-blue-500/15 text-blue-300'
              : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
          }`}
        >
          <span className="flex items-center gap-1.5">
              {mixedPaymentMode
                ? <><Check className="w-3 h-3" /> Pago mixto activado</>
                : <><CreditCard className="w-3 h-3" /> Pago mixto (efectivo + tarjeta...)</>
              }
            </span>
        </button>

        {/* Mixed payment splits */}
        {mixedPaymentMode && (
          <div className="space-y-2 bg-blue-500/8 rounded-xl p-3 border border-blue-400/15">
            {mixedSplits.map((split, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={split.method} onChange={(e) => updateMixedSplit(i, 'method', e.target.value)}
                  className="h-8 px-2 rounded-xl border border-white/15 bg-white/8 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-primary/40 flex-1 min-w-0">
                  {PAYMENT_METHODS.map(pm => <option key={pm.id} value={pm.id} className="bg-[#07142f]">{pm.label}</option>)}
                </select>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/40">$</span>
                  <input type="number" value={split.amount || ''} onChange={(e) => updateMixedSplit(i, 'amount', e.target.value)}
                    className="w-24 h-8 pl-5 pr-2 rounded-xl border border-white/15 bg-white/8 text-xs font-bold text-right text-white focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="0" />
                </div>
                {mixedSplits.length > 2 && (
                  <button onClick={() => removeMixedSplit(i)} className="w-6 h-6 flex items-center justify-center text-white/35 hover:text-red-400 transition">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button onClick={addMixedSplit} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition">+ Agregar medio</button>
              <span className={`text-xs font-bold ${Math.abs(mixedRemaining) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.abs(mixedRemaining) < 0.01 ? '✓ Completo' : `Resta: ${formatCurrency(mixedRemaining)}`}
              </span>
            </div>
          </div>
        )}

        {/* Cuotas selector for credit */}
        {!mixedPaymentMode && paymentMethod === 'credit' && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Cuotas</p>
            <div className="grid grid-cols-4 gap-1">
              {CUOTA_OPTIONS.map((opt) => (
                <button key={opt.n} onClick={() => handleSelectCuota(opt)}
                  className={`py-1.5 rounded-xl text-[11px] font-semibold border transition-all active:scale-95 ${
                    installments === opt.n
                      ? 'border-primary bg-primary/20 text-primary shadow-sm shadow-primary/20'
                      : 'border-white/10 text-white/45 hover:border-white/25 hover:text-white/70'
                  }`}>
                  {opt.label}
                  {opt.surcharge > 0 && <span className="block text-[9px] opacity-70">+{opt.surcharge}%</span>}
                </button>
              ))}
            </div>
            {surchargePct > 0 && (
              <div className="flex items-center justify-between text-[11px] text-blue-400">
                <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Recargo {surchargePct}%</span>
                <span>+{formatCurrency(getSubtotal() * (1 - discount / 100) * surchargePct / 100)}</span>
              </div>
            )}
          </div>
        )}

        {/* Receipt type selector */}
        <button
          onClick={() => setShowReceiptModal(true)}
          className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border border-white/10 bg-white/4 hover:bg-white/7 transition"
        >
          <FileText className="w-3.5 h-3.5 text-white/35 shrink-0" />
          <span className="text-white/40 text-[11px]">Comprobante</span>
          <span className="font-semibold text-white text-[12px] ml-auto">
            {receiptType === 'ticket' ? 'Ticket' : `Factura ${receiptType}`}
          </span>
          <ChevronRight className="w-3 h-3 text-white/25" />
        </button>

        {discount > 0 && (
          <div className="flex items-center justify-between text-xs text-amber-400 bg-amber-400/8 rounded-lg px-2.5 py-1.5">
            <span>Descuento {discount}%</span>
            <span className="font-semibold">-{formatCurrency(getSubtotal() * discount / 100)}</span>
          </div>
        )}

        {pmDiscountPct > 0 && !mixedPaymentMode && (
          <div className="flex items-center justify-between text-xs text-green-400 bg-green-400/8 rounded-lg px-2.5 py-1.5">
            <span>Dto. por {PAYMENT_LABELS[paymentMethod]} ({pmDiscountPct}%)</span>
            <span className="font-semibold">
              -{formatCurrency(getSubtotal() * (1 - discount / 100) * (1 + surchargePct / 100) * pmDiscountPct / 100)}
            </span>
          </div>
        )}

        {/* Total + Cobrar */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/45 uppercase tracking-widest">Total a cobrar</span>
            <span className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(getTotal())}</span>
          </div>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={items.length === 0}
            className="w-full h-12 rounded-xl font-bold text-[15px] text-white bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            COBRAR
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Sale success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="glass-card rounded-2xl p-10 text-center animate-scale-in border border-primary/30 shadow-2xl shadow-primary/20">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-primary" />
            </div>
            <p className="text-xl font-bold text-white">¡Venta registrada!</p>
            <p className="text-sm text-white/50 mt-1">
              {receiptType !== 'ticket' ? `Factura ${receiptType} generada` : 'Ticket generado'}
            </p>
          </div>
        </div>
      )}

      {/* ── Main two-column layout ── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: Search + Product grid */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">

          {/* Search strip */}
          <div className="px-3 sm:px-4 py-3 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar producto o escanear código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-10 pl-10 pr-3 text-sm rounded-xl border border-white/12 bg-white/8 text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/10 transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/12 flex items-center justify-center hover:bg-white/20 transition"
                  >
                    <X className="w-3 h-3 text-white/60" />
                  </button>
                )}
              </div>
              <button
                onClick={startCameraScanner}
                className="w-10 h-10 rounded-xl border border-white/12 bg-white/8 flex items-center justify-center text-white/45 hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-95 shrink-0"
                title="Escanear con cámara"
              >
                <Camera className="w-4 h-4" />
              </button>
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 border ${
                cajaOpen
                  ? 'bg-green-500/12 text-green-400 border-green-500/25'
                  : 'bg-red-500/12 text-red-400 border-red-500/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${ cajaOpen ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span className="hidden md:inline">{cajaOpen ? 'Caja abierta' : 'Caja cerrada'}</span>
              </div>
            </div>
          </div>

          {/* Product cards launcher-style grid */}
          <div className="flex-1 overflow-auto p-3 sm:p-4">
            {search ? (
              filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/25 py-12">
                  <Search className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {filteredProducts.map((product, idx) => (
                    <button
                      key={product.id}
                      onClick={() => { handleProductClick(product); setSearch('') }}
                      disabled={product.stock <= 0}
                      style={{ animationDelay: `${idx * 18}ms` }}
                      className={`group animate-fade-in-up relative flex flex-col bg-white/6 border rounded-2xl p-3 text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.95] ${
                        product.stock <= product.stock_min && product.stock > 0
                          ? 'border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-500/8 hover:shadow-lg hover:shadow-amber-500/10'
                          : 'border-white/8 hover:border-primary/50 hover:bg-white/10 hover:shadow-lg hover:shadow-primary/8'
                      }`}
                    >
                      <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                        product.stock === 0 ? 'bg-red-500/20 text-red-400'
                          : product.stock <= product.stock_min ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-green-500/15 text-green-400'
                      }`}>
                        {isDecimalUnit(product.unit) ? product.stock.toFixed(1) : product.stock}
                      </span>
                      <div className="flex-1 pr-8">
                        <h3 className="text-[13px] font-semibold text-white line-clamp-2 leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                        {product.brand && <p className="text-[10px] text-white/35 truncate mt-0.5">{product.brand}</p>}
                      </div>
                      <p className="text-base font-bold text-primary mt-2">{formatCurrency(product.sale_price)}</p>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/20 select-none">
                <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-3">
                  <Search className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-sm font-medium text-white/35">Buscá un producto</p>
                <p className="text-xs text-white/20 mt-1">Nombre, marca o código</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart panel — desktop */}
        <div className="hidden lg:flex w-80 xl:w-96 border-l border-white/8 bg-white/3 flex-col shrink-0">
          {cartContent}
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden shrink-0 border-t border-white/8 bg-[rgba(7,20,47,0.92)] backdrop-blur-xl px-3 py-2.5">
        <button
          onClick={() => setShowCart(true)}
          className="w-full flex items-center gap-3 bg-white/6 border border-white/10 rounded-2xl px-4 py-2.5 hover:bg-white/10 active:scale-[0.98] transition-all"
        >
          <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-left text-sm text-white/50">
            {items.length === 0 ? 'Carrito vacío' : `${items.length} producto${items.length !== 1 ? 's' : ''}`}
          </span>
          {items.length > 0 && (
            <span className="text-base font-bold text-primary">{formatCurrency(getTotal())}</span>
          )}
          <span
            onClick={(e) => { e.stopPropagation(); if (items.length > 0) setShowConfirmModal(true) }}
            className={`px-4 py-1.5 rounded-xl text-white text-sm font-bold transition shrink-0 ${
              items.length === 0 ? 'bg-primary/30 opacity-40 cursor-not-allowed' : 'bg-primary active:scale-95'
            }`}
          >
            Cobrar
          </span>
        </button>
      </div>

      {/* Mobile cart — bottom sheet */}
      {showCart && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCart(false)} />
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[rgba(7,20,47,0.97)] border-t border-white/12 backdrop-blur-2xl rounded-t-3xl shadow-2xl dark-shell animate-slide-in-up"
            style={{ maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {cartContent}
          </div>
        </>
      )}

      {/* Quantity input modal for decimal units */}
      <Modal open={!!qtyInputProduct} onClose={() => setQtyInputProduct(null)} title="Cantidad" size="sm">
        {qtyInputProduct && (
          <div className="space-y-4">
            <div className="bg-white/6 border border-white/10 rounded-xl p-3 text-center">
              <p className="font-semibold text-white">{qtyInputProduct.name}</p>
              <p className="text-sm text-white/50 mt-1">{formatCurrency(qtyInputProduct.sale_price)} / {getUnitLabel(qtyInputProduct)}</p>
              <p className="text-xs text-white/35">Stock: {qtyInputProduct.stock.toFixed(2)} {getUnitLabel(qtyInputProduct)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Cantidad ({getUnitLabel(qtyInputProduct)})</label>
              <input
                type="number" step="0.01" min="0.01" autoFocus
                value={qtyInputValue}
                onChange={(e) => setQtyInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmQtyInput() }}
                className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/8 text-white text-lg font-bold text-center focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              />
            </div>
            {qtyInputValue && parseFloat(qtyInputValue) > 0 && (
              <div className="text-center text-2xl font-bold text-primary">
                = {formatCurrency(qtyInputProduct.sale_price * parseFloat(qtyInputValue))}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setQtyInputProduct(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleConfirmQtyInput}>Agregar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Camera scanner modal */}
      <Modal open={showCameraScanner} onClose={stopCameraScanner} title="Escanear código" size="md">
        <div className="space-y-3">
          <div id="camera-scanner-region" ref={cameraContainerRef} className="rounded-xl overflow-hidden bg-black min-h-64" />
          <p className="text-sm text-center text-muted-foreground">Apuntá la cámara al código de barras</p>
          <Button variant="outline" className="w-full" onClick={stopCameraScanner}>
            <X className="w-4 h-4" /> Cancelar
          </Button>
        </div>
      </Modal>

      {/* Customer modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Seleccionar cliente" size="sm">
        <input type="text" placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/35 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/20" />
        <div className="space-y-1.5 max-h-64 overflow-auto">
          <button onClick={() => { setCustomerId(null); setDocTipoCustomer('99'); setDocNroCustomer(''); setShowCustomerModal(false) }}
            className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition">
            Consumidor Final
          </button>
          {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
            <button key={c.id} onClick={() => {
              setCustomerId(c.id)
              setDocTipoCustomer((c as any).doc_tipo || '99')
              setDocNroCustomer((c as any).doc_nro || '')
              setShowCustomerModal(false)
            }}
              className={`w-full text-left p-3 rounded-xl border transition ${
                customerId === c.id
                  ? 'border-primary/60 bg-primary/12 shadow-sm shadow-primary/15'
                  : 'border-white/10 bg-white/4 hover:bg-white/9'
              }`}>
              <p className="text-sm font-semibold text-white">{c.name}</p>
              {c.phone && <p className="text-xs text-white/45">{c.phone}</p>}
              {(c as any).doc_nro && <p className="text-[11px] text-white/35">{DOC_TIPOS.find(d => String(d.id) === (c as any).doc_tipo)?.code}: {(c as any).doc_nro}</p>}
              {c.balance > 0 && <Badge variant="warning" className="mt-1">Deuda: {formatCurrency(c.balance)}</Badge>}
            </button>
          ))}
        </div>
      </Modal>

      {/* Receipt type modal */}
      <Modal open={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Tipo de comprobante" size="sm">
        <div className="space-y-2">
          {RECEIPT_TYPES.map((rt) => {
            const isFiscal = rt.id !== 'ticket'
            const isDisabled = isFiscal && !isFiscalConnected
            return (
              <button key={rt.id}
                onClick={() => { if (!isDisabled) { setReceiptType(rt.id); setShowReceiptModal(false) } }}
                disabled={isDisabled}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isDisabled
                    ? 'border-white/6 bg-white/2 opacity-45 cursor-not-allowed'
                    : receiptType === rt.id
                    ? 'border-primary/60 bg-primary/12 shadow-sm shadow-primary/15'
                    : 'border-white/10 bg-white/4 hover:bg-white/10'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    rt.id === 'ticket' ? 'bg-white/10 text-white/70' :
                    rt.id === 'A' ? 'bg-blue-500/20 text-blue-300' :
                    rt.id === 'B' ? 'bg-green-500/20 text-green-300' :
                    'bg-purple-500/20 text-purple-300'
                  }`}>
                    {rt.id === 'ticket' ? <Receipt className="w-4 h-4" /> : rt.id}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{rt.label}</p>
                    <p className="text-xs text-white/40">
                      {isDisabled ? 'Configurá AFIP en Ajustes' : rt.desc}
                    </p>
                  </div>
                  {receiptType === rt.id && !isDisabled && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                  )}
                </div>
              </button>
            )
          })}
          {!isFiscalConnected && (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center mt-2">
              Las facturas A/B/C requieren conexión AFIP. Configurala en Ajustes → Facturación.
            </p>
          )}
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar venta" size="sm">
        <div className="space-y-4">
          <div className="bg-white/6 border border-white/10 rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Productos</span>
                <span className="font-semibold text-white">
                  {items.reduce((s, i) => s + i.quantity, 0)} {items.length === 1 ? getUnitLabel(items[0].product) : 'items'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Cliente</span>
                <span className="font-semibold text-white">{selectedCustomer?.name || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Medio de pago</span>
                <span className="font-semibold text-white">{mixedPaymentMode ? 'Pago mixto' : PAYMENT_LABELS[paymentMethod]}</span>
              </div>
              {mixedPaymentMode && mixedSplits.filter(s => s.amount > 0).map((s, i) => (
                <div key={i} className="flex justify-between text-xs pl-4">
                  <span className="text-white/40">{PAYMENT_LABELS[s.method]}</span>
                  <span className="font-semibold text-white/80">{formatCurrency(s.amount)}</span>
                </div>
              ))}
              {!mixedPaymentMode && paymentMethod === 'credit' && installments > 1 && (
                <div className="flex justify-between">
                  <span className="text-white/50">Cuotas</span>
                  <span className="font-semibold text-white">{installments}x {formatCurrency(getTotal() / installments)} (+{surchargePct}%)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/50">Comprobante</span>
                <span className="font-semibold text-white">{receiptType === 'ticket' ? 'Ticket' : `Factura ${receiptType}`}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Descuento {discount}%</span>
                  <span className="font-semibold">-{formatCurrency(getSubtotal() * discount / 100)}</span>
                </div>
              )}
              {surchargePct > 0 && (
                <div className="flex justify-between text-blue-400">
                  <span>Recargo {surchargePct}%</span>
                  <span className="font-semibold">+{formatCurrency(getSubtotal() * (1 - discount / 100) * surchargePct / 100)}</span>
                </div>
              )}
              {receiptType === 'A' && (() => {
                const iva = calculateIVA('A', items, discount, surchargePct)
                return (
                  <>
                    <div className="flex justify-between text-xs text-blue-400">
                      <span>Neto gravado</span>
                      <span>{formatCurrency(iva.netoGravado)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-400">
                      <span>IVA 21%</span>
                      <span>{formatCurrency(iva.ivaAmount)}</span>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/10">
              <span className="text-lg font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(getTotal())}</span>
            </div>
          </div>

          {receiptType === 'A' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-white/60 block mb-1">Tipo doc.</label>
                  <select value={docTipoCustomer} onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl border border-white/15 bg-white/8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DOC_TIPOS.map(d => <option key={d.id} value={d.id} className="bg-[#07142f]">{d.code}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-white/60 block mb-1">Nro. doc. *</label>
                  <input type="text" placeholder="20-12345678-9" value={docNroCustomer} onChange={(e) => setDocNroCustomer(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
          )}
          {receiptType === 'B' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-white/60 block mb-1">Tipo doc.</label>
                  <select value={docTipoCustomer} onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl border border-white/15 bg-white/8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DOC_TIPOS.map(d => <option key={d.id} value={d.id} className="bg-[#07142f]">{d.code}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-white/60 block mb-1">Nro. doc. (opc.)</label>
                  <input type="text" placeholder="DNI / CUIT" value={docNroCustomer} onChange={(e) => setDocNroCustomer(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <p className="text-[10px] text-white/35">Para montos mayores a $22.850 AFIP puede requerir identificación</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
            <Button className="flex-1 h-12" onClick={handleConfirmSale} disabled={processing}>
              {processing ? 'Procesando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>

      <PostSaleModal
        open={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        data={postSaleData}
      />
    </div>
  )
}

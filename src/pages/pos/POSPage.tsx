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
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
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
    if (profile?.business_id) { 
      fetchProducts(); 
      fetchCustomers(); 
      fetchCategories();
      checkCajaOpen() 
    }
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
  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('id, name').eq('business_id', profile!.business_id).order('name')
    setCategories(data || [])
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.barcode && p.barcode.includes(search)) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.model && p.model.toLowerCase().includes(search.toLowerCase()))
    
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    
    return matchesSearch && matchesCategory
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
    <div className="flex flex-col h-full bg-white/[0.01]">

      {/* Cart header */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm">Venta</span>
                {items.length > 0 && (
                  <span className="bg-primary text-white text-[9px] font-black rounded-md px-1 py-0.5">
                    {items.length}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">Terminal #01</p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all font-bold"
              title="Vaciar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Customer selector */}
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-white/15 uppercase tracking-widest ml-1">Cliente</p>
          <button
            onClick={() => setShowCustomerModal(true)}
            className={`flex items-center gap-2 w-full p-2.5 rounded-xl border transition-all ${
              selectedCustomer
                ? 'border-primary/20 bg-primary/5 text-white'
                : 'border-white/5 bg-white/[0.02] text-white/30 hover:bg-white/5 hover:text-white/50'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
              selectedCustomer ? 'bg-primary/20 text-primary border-primary/20' : 'bg-white/5 text-white/10 border-white/5'
            }`}>
              <User className="w-3 h-3" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="truncate text-[12px] font-bold">
                {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
              </p>
            </div>
            {selectedCustomer ? (
              <span
                onClick={(e) => { e.stopPropagation(); setCustomerId(null) }}
                className="w-5 h-5 rounded-md hover:bg-white/10 flex items-center justify-center text-white/10 hover:text-red-400 transition"
              >
                <X className="w-3 h-3" />
              </span>
            ) : (
              <ChevronRight className="w-3 h-3 text-white/5" />
            )}
          </button>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-auto px-3 py-1 space-y-1 min-h-0 custom-scrollbar">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/5 py-8">
            <ShoppingCart className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs font-bold tracking-tight opacity-30">Vacío</p>
          </div>
        ) : (
          items.map((item) => {
            const decimal = isDecimalUnit(item.product.unit)
            const unit = UNIT_SHORT[item.product.unit as ProductUnit] || item.product.unit
            return (
              <div key={item.product.id} className="group flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-lg p-2 hover:bg-white/[0.04] transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-white/90 leading-tight">{item.product.name}</p>
                  <p className="text-[10px] text-white/20 font-medium mt-0.5">
                    {formatCurrency(item.price)} × {item.quantity}{unit}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/5">
                    {decimal ? (
                      <input
                        type="number" step="0.1" min="0.1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-12 h-5 text-center text-[11px] font-bold bg-transparent text-white focus:outline-none"
                      />
                    ) : (
                      <>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/5 transition">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-[11px] font-bold text-white tabular-nums">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-primary hover:bg-primary/10 transition">
                          <Plus className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <span className="text-[12px] font-black text-white/80 tabular-nums">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Cart footer */}
      <div className="px-3 pb-4 pt-2 space-y-3 shrink-0 bg-white/[0.01] border-t border-white/5">
        
        {/* Payment Methods Grid */}
        {!mixedPaymentMode && (
          <div className="grid grid-cols-5 gap-1.5">
            {PAYMENT_METHODS.map((pm) => {
              const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
              const pmPct = discounts?.[pm.id] ?? 0
              return (
              <button key={pm.id} onClick={() => handleSelectPaymentMethod(pm.id)}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl text-[9px] font-bold border transition-all active:scale-95 ${
                  paymentMethod === pm.id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-white/5 bg-white/[0.02] text-white/20 hover:text-white/40'
                }`}>
                <pm.icon className="w-3.5 h-3.5" />
                <span className="uppercase tracking-tighter">{pm.label}</span>
                {pmPct > 0 && <span className="text-[7px] font-black text-green-400">-{pmPct}%</span>}
              </button>
              )
            })}
          </div>
        )}

        {/* Action Pills */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setMixedPaymentMode(!mixedPaymentMode)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
              mixedPaymentMode
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold'
                : 'border-white/5 bg-white/5 text-white/20 hover:text-white/40'
            }`}
          >
            {mixedPaymentMode ? <Check className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
            {mixedPaymentMode ? 'Mixto' : 'Dividir'}
          </button>
          
          <button
            onClick={() => setShowReceiptModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-white/5 bg-white/5 text-white/20 hover:text-white/40 transition-all font-mono"
          >
            <FileText className="w-3 h-3" />
            {receiptType === 'ticket' ? 'TICKET' : `${receiptType}`}
          </button>
        </div>

        {/* Mixed splits list */}
        {mixedPaymentMode && (
          <div className="space-y-1.5 bg-blue-500/[0.02] rounded-xl p-2.5 border border-blue-500/10 animate-fade-in font-bold">
            {mixedSplits.map((split, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select value={split.method} onChange={(e) => updateMixedSplit(i, 'method', e.target.value)}
                  className="h-8 px-2 rounded-lg border border-white/5 bg-white/5 text-[10px] font-bold text-white/60 focus:outline-none flex-1 min-w-0">
                  {PAYMENT_METHODS.map(pm => <option key={pm.id} value={pm.id} className="bg-[#07142f]">{pm.label}</option>)}
                </select>
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/10">$</span>
                  <input type="number" value={split.amount || ''} onChange={(e) => updateMixedSplit(i, 'amount', e.target.value)}
                    className="w-full h-8 pl-4 pr-2 rounded-lg border border-white/5 bg-white/5 text-xs font-bold text-right text-white focus:outline-none" placeholder="0" />
                </div>
                {mixedSplits.length > 2 && (
                  <button onClick={() => removeMixedSplit(i)} className="w-7 h-7 rounded-md flex items-center justify-center text-white/10 hover:text-red-400 transition font-bold">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between pt-0.5">
              <button onClick={addMixedSplit} className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">+ Agregar</button>
              <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${Math.abs(mixedRemaining) < 0.01 ? 'text-green-400' : 'text-red-300'}`}>
                {Math.abs(mixedRemaining) < 0.01 ? '✓ Cubierto' : `Resta: ${formatCurrency(mixedRemaining)}`}
              </div>
            </div>
          </div>
        )}

        {/* Final Receipt / Summary */}
        <div className="space-y-1.5">
          {discount > 0 && (
            <div className="flex justify-between items-center text-[10px] font-bold text-amber-500/50 uppercase tracking-widest">
              <span>Descuento ({discount}%)</span>
              <span>-{formatCurrency(getSubtotal() * discount / 100)}</span>
            </div>
          )}
          
          {/* Main Total Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Total a cobrar</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Online</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-white/20">$</span>
                <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
                  {getTotal().toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="text-lg font-bold text-white/40 tabular-nums">
                  ,{(getTotal() % 1).toFixed(2).split('.')[1]}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={items.length === 0}
              className="w-full mt-3 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-lg shadow-primary/10 disabled:bg-white/5 disabled:text-white/10 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              COBRAR
            </button>
          </div>
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
          <div className="px-3 py-2.5 border-b border-white/8 shrink-0 space-y-2 bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-primary transition-colors" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                  >
                    <X className="w-3 h-3 text-white/50" />
                  </button>
                )}
              </div>
              <button
                onClick={startCameraScanner}
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/30 hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all active:scale-95 shrink-0"
              >
                <Camera className="w-4 h-4" />
              </button>
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-black shrink-0 border transition-all ${
                cajaOpen
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/15'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${ cajaOpen ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span className="hidden md:inline uppercase tracking-widest">{cajaOpen ? 'En Caja' : 'Cerrada'}</span>
              </div>
            </div>

            {/* Category bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                  !selectedCategory
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10 hover:text-white/50'
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10 hover:text-white/50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
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
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {filteredProducts.map((product, idx) => (
                    <button
                      key={product.id}
                      onClick={() => { handleProductClick(product); setSearch('') }}
                      disabled={product.stock <= 0}
                      style={{ animationDelay: `${idx * 12}ms` }}
                      className={`group animate-slide-in-up relative flex flex-col bg-white/[0.03] border rounded-xl p-2.5 text-left transition-all hover:bg-white/[0.06] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed ${
                        product.stock <= product.stock_min && product.stock > 0
                          ? 'border-amber-400/20 shadow-sm shadow-amber-400/5'
                          : 'border-white/5 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight ${
                          product.stock === 0 ? 'bg-red-500/20 text-red-400'
                            : product.stock <= product.stock_min ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}>
                          {isDecimalUnit(product.unit) ? product.stock.toFixed(1) : product.stock} {UNIT_SHORT[product.unit as ProductUnit] || product.unit}
                        </span>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-[12px] font-bold text-white/80 leading-tight transition-colors">
                          {product.name}
                        </h3>
                        {product.brand && (
                          <p className="text-[9px] text-white/30 mt-0.5 font-medium uppercase tracking-wider">{product.brand}</p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-base font-black text-primary tabular-nums">
                          {formatCurrency(product.sale_price)}
                        </p>
                      </div>
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

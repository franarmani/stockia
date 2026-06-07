import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { usePOSStore, isDecimalUnit, type PaymentMethodType, type ReceiptType, type PaymentSplit } from '@/stores/posStore'
import { useFiscalStore } from '@/stores/fiscalStore'
import { formatCurrency } from '@/lib/utils'
import { UNIT_SHORT, DOC_TIPOS, type ProductUnit } from '@/types/database'
import { requestCAE, calculateIVA, getCbteTipo } from '@/lib/afipService'
import { queueSale } from '@/lib/offlineQueue'
import { syncProductsCache, getCachedProducts, updateCachedStock } from '@/lib/offlineProductsCache'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import PostSaleModal, { type PostSaleData } from '@/components/PostSaleModal'
import type { Product, Customer, CartItem } from '@/types/database'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, ArrowRightLeft, X, CheckCircle2, User, Wallet,
  FileText, Receipt, Percent, CircleDollarSign, Camera, ChevronRight, Check, Package,
  LogOut, Zap, ScanLine,
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
  const navigate = useNavigate()
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
  const [docTipoCustomer, setDocTipoCustomer] = useState('99')
  const [docNroCustomer, setDocNroCustomer] = useState('')
  const [qtyInputProduct, setQtyInputProduct] = useState<Product | null>(null)
  const [qtyInputValue, setQtyInputValue] = useState('')
  const [postSaleData, setPostSaleData] = useState<PostSaleData | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cameraContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.business_id) {
      fetchProducts()
      fetchCustomers()

      checkCajaOpen()
    }
  }, [profile?.business_id])

  useEffect(() => { searchRef.current?.focus() }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F4') { e.preventDefault(); setShowCustomerModal(true) }
      if (e.key === 'F8') { e.preventDefault(); if (items.length > 0) setShowConfirmModal(true) }
      if (e.key === 'Escape') { setShowCustomerModal(false); setShowReceiptModal(false); setShowConfirmModal(false); setQtyInputProduct(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length])

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
      const cached = await getCachedProducts(profile!.business_id)
      if (cached.length > 0) {
        setProducts(cached as Product[])
        toast.info(`Modo offline: ${cached.length} productos cargados desde caché`)
        return
      }
    }
    const { data } = await supabase.from('products').select('*').eq('business_id', profile!.business_id).eq('active', true).order('name')
    setProducts(data || [])
    if (data && data.length > 0) syncProductsCache(data as any).catch(() => {})
  }
  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').eq('business_id', profile!.business_id).order('name')
    setCustomers(data || [])
  }
  async function checkCajaOpen() {
    const { data } = await supabase.from('cash_sessions').select('id').eq('business_id', profile!.business_id).is('closed_at', null).limit(1)
    setCajaOpen(!!(data && data.length > 0))
  }

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(search)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q))
    )
  }, [products, search])

  const visibleProducts = useMemo(() => filteredProducts.slice(0, 48), [filteredProducts])

  // Show first 12 products when no search → "Venta rápida"
  const quickProducts = useMemo(() => {
    if (search) return []
    return products.slice(0, 12)
  }, [products, search])

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

  function handleSelectPaymentMethod(method: PaymentMethodType) {
    setPaymentMethod(method)
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    const pct = discounts?.[method] ?? 0
    setPmDiscountPct(pct)
  }

  useEffect(() => {
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    const pct = discounts?.[paymentMethod] ?? 0
    setPmDiscountPct(pct)
  }, [business])

  function addMixedSplit() {
    setMixedSplits([...mixedSplits, { method: 'cash', amount: 0 }])
  }
  function updateMixedSplit(index: number, field: 'method' | 'amount', value: string) {
    setMixedSplits(mixedSplits.map((s, i) => i === index ? { ...s, [field]: field === 'amount' ? Number(value) : value as any } : s))
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

      if (!navigator.onLine) {
        if (receiptType !== 'ticket') {
          toast.error('Sin conexión: solo se pueden hacer ventas con Ticket')
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
          primaryColor: business?.primary_color || '#22c55e',
          autoPrint: business?.auto_print || false,
        })

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
        primaryColor: business?.primary_color || '#22c55e',
        autoPrint: business?.auto_print || false,
      })

      clearCart(); setDocNroCustomer(''); setDocTipoCustomer('99'); setShowConfirmModal(false); setShowSuccess(true); setShowTicketModal(true)
      setMixedPaymentMode(false); setMixedSplits([{ method: 'cash', amount: 0 }, { method: 'debit', amount: 0 }])
      playBeep(); fetchProducts()
      setTimeout(() => setShowSuccess(false), 2500)
    } catch { toast.error('Error inesperado') } finally { setProcessing(false) }
  }

  const subtotalRaw = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmt = subtotalRaw * discount / 100
  const afterDiscount = subtotalRaw - discountAmt
  const surchargeAmt = (afterDiscount * surchargePct) / 100
  const totalDisplay = getTotal()
  const pmDiscounts = (business as any)?.payment_method_discounts as Record<string, number> | null
  const currentPmDiscount = pmDiscounts?.[paymentMethod] ?? 0
  const effectiveDiscountPct = discount + (paymentMethod !== 'account' ? currentPmDiscount : 0)

  // ──────────────────────────────────────────────── //
  //                   RENDER                          //
  // ──────────────────────────────────────────────── //

  return (
    <div className="flex flex-col h-dvh bg-[#07111f] overflow-hidden">
      {/* Sale success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-[#0d1b2d] border border-white/10 rounded-2xl p-10 text-center animate-fade-in shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-primary" />
            </div>
            <p className="text-xl font-bold text-white">¡Venta registrada!</p>
            <p className="text-sm text-slate-400 mt-1">
              {receiptType !== 'ticket' ? `Factura ${receiptType} generada` : 'Ticket generado'}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ HEADER ═══════════ */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-white/8 bg-[#0d1b2d]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/menu')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-all"
            title="Volver al menú"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/8" />
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Nueva venta</span>
          </div>
          {business?.name && (
            <>
              <span className="text-slate-600 text-sm font-medium hidden sm:inline">·</span>
              <span className="text-slate-400 text-sm hidden sm:inline">{business.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
            cajaOpen
              ? 'bg-green-500/8 text-green-400/90 border-green-500/15'
              : 'bg-red-500/8 text-red-400/90 border-red-500/15'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${cajaOpen ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="uppercase tracking-wider">{cajaOpen ? 'Caja abierta' : 'Caja cerrada'}</span>
          </div>
          {profile?.name && (
            <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs font-medium">
              <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-500" />
              </div>
              <span>{profile.name?.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </header>

      {/* ═══════════ MAIN WORKSPACE ═══════════ */}
      <div className="flex-1 flex min-h-0" style={{ height: 'calc(100dvh - 3.5rem)' }}>
        {/* ──────── LEFT PANEL ──────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-[calc(100vw-420px)]">
          {/* Toolbar */}
          <div className="shrink-0 px-3 py-2.5 border-b border-white/8 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xl group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar por nombre, código o marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-11 pl-10 pr-24 text-sm rounded-xl border border-white/8 bg-[#0d1b2d] text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {search && (
                    <button onClick={() => setSearch('')}
                      className="w-6 h-6 rounded-md bg-white/8 flex items-center justify-center hover:bg-white/8 transition-colors">
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                  <span className="text-[9px] font-bold text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-md uppercase tracking-wider hidden sm:inline">F2</span>
                </div>
              </div>
              <button
                onClick={startCameraScanner}
                className="w-11 h-11 rounded-xl border border-white/8 bg-[#0d1b2d] flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-90 shrink-0"
                title="Escanear código de barras"
              >
                <ScanLine className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="hidden md:flex h-11 items-center gap-2 px-3.5 rounded-xl border border-white/8 bg-[#0d1b2d] text-slate-400 hover:text-white hover:border-white/10 transition-all text-xs font-bold"
              >
                <User className="w-4 h-4" />
                <span className="hidden lg:inline">Cliente</span>
              </button>
            </div>

          </div>

          {/* Product area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {search ? (
              filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 opacity-40" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">No se encontraron productos</p>
                  <p className="text-xs text-slate-600 mt-1">Probá con otro término de búsqueda</p>
                </div>
              ) : (
                <div className="p-3">
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                    {visibleProducts.map((product, idx) => (
                      <button
                        key={product.id}
                        onClick={() => { handleProductClick(product); setSearch('') }}
                        disabled={product.stock <= 0}
                        style={{ animationDelay: `${idx * 12}ms` }}
                        className={`group relative flex flex-col rounded-xl p-3.5 text-left transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed min-h-[112px] overflow-hidden bg-[#122238] border ${
                          product.stock === 0
                            ? 'border-red-500/10 opacity-40'
                            : product.stock <= (product.stock_min || 0)
                            ? 'border-amber-500/15 hover:border-amber-500/30 hover:bg-[#1a2d3d]'
                            : 'border-white/8 hover:border-primary/20 hover:bg-[#1a2d3d]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 relative z-[1]">
                          <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 flex-1 text-left">
                            {product.name}
                          </h3>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            product.stock === 0 ? 'bg-red-500/15 text-red-400'
                              : product.stock <= (product.stock_min || 0) ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-white/8 text-slate-400'
                          }`}>
                            {isDecimalUnit(product.unit) ? product.stock.toFixed(1) : Math.floor(product.stock)}
                            <span className="ml-0.5">{UNIT_SHORT[product.unit as ProductUnit] || product.unit}</span>
                          </span>
                        </div>
                        <div className="flex-1 relative z-[1]" />
                        <div className="flex items-end justify-between relative z-[1] mt-auto">
                          <div>
                            <p className="text-lg font-bold text-white tabular-nums leading-none">
                              {formatCurrency(product.sale_price)}
                            </p>
                            {product.brand && (
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5 block">{product.brand}</span>
                            )}
                          </div>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            product.stock > 0
                              ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
                              : 'bg-white/5 text-slate-600'
                          }`}>
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {filteredProducts.length > 48 && (
                    <p className="text-center text-xs text-slate-600 mt-3 pb-2">
                      Mostrando 48 de {filteredProducts.length} productos
                    </p>
                  )}
                </div>
              )
            ) : (
              <div className="p-3 h-full flex flex-col">
                {/* Quick products - Venta rápida */}
                {quickProducts.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-bold text-white">Venta rápida</h2>
                      <span className="text-[10px] text-slate-500 font-medium">Productos disponibles</span>
                    </div>
                    <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', alignContent: 'start' }}>
                      {quickProducts.map((product, idx) => (
                        <button
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          disabled={product.stock <= 0}
                          className={`group relative flex flex-col rounded-xl p-3.5 text-left transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed min-h-[112px] overflow-hidden bg-[#122238] border ${
                            product.stock === 0
                              ? 'border-red-500/10 opacity-40'
                              : product.stock <= (product.stock_min || 0)
                              ? 'border-amber-500/15 hover:border-amber-500/30 hover:bg-[#1a2d3d]'
                              : 'border-white/8 hover:border-primary/20 hover:bg-[#1a2d3d]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 relative z-[1]">
                            <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 flex-1 text-left">
                              {product.name}
                            </h3>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              product.stock === 0 ? 'bg-red-500/15 text-red-400'
                                : product.stock <= (product.stock_min || 0) ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-white/8 text-slate-400'
                            }`}>
                              {isDecimalUnit(product.unit) ? product.stock.toFixed(1) : Math.floor(product.stock)}
                              <span className="ml-0.5">{UNIT_SHORT[product.unit as ProductUnit] || product.unit}</span>
                            </span>
                          </div>
                          <div className="flex-1 relative z-[1]" />
                          <div className="flex items-end justify-between relative z-[1] mt-auto">
                            <div>
                              <p className="text-lg font-bold text-white tabular-nums leading-none">
                                {formatCurrency(product.sale_price)}
                              </p>
                              {product.brand && (
                                <span className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5 block">{product.brand}</span>
                              )}
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-all">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center flex-1 select-none">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-5">
                      <ShoppingCart className="w-8 h-8 text-slate-600" />
                    </div>
                    <h2 className="text-base font-bold text-white mb-1">Empezá una nueva venta</h2>
                    <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                      Buscá un producto por nombre, código o marca. También podés usar el escáner para agregarlo directamente.
                    </p>
                    <div className="flex flex-col items-center gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/8 text-[10px] font-bold text-slate-400">F2</kbd>
                        <span>Buscar producto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/8 text-[10px] font-bold text-slate-400">F4</kbd>
                        <span>Seleccionar cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/8 text-[10px] font-bold text-slate-400">F8</kbd>
                        <span>Cobrar</span>
                      </div>
                    </div>
                    <button
                      onClick={startCameraScanner}
                      className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/8 transition-all text-xs font-bold"
                    >
                      <ScanLine className="w-4 h-4" />
                      Usar escáner
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ──────── RIGHT PANEL — CHECKOUT ──────── */}
        <div className="hidden lg:flex w-[420px] shrink-0 border-l border-white/8 flex-col bg-[#0d1b2d]">
          {/* Checkout header */}
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ShoppingCart className="w-[18px] h-[18px] text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Venta actual</span>
                    {items.length > 0 && (
                      <span className="bg-primary/20 text-primary text-[10px] font-bold rounded-md px-1.5 py-0.5 tabular-nums">
                        {items.reduce((s, i) => s + i.quantity, 0)} ítems
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Terminal #01</p>
                </div>
              </div>
              {items.length > 0 && (
                <button onClick={clearCart}
                  className="w-8 h-8 rounded-lg border border-white/8 bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                  title="Vaciar venta">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Customer selector */}
            <button
              onClick={() => setShowCustomerModal(true)}
              className={`flex items-center gap-2.5 w-full p-3 rounded-xl border transition-all ${
                selectedCustomer
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-white/8 bg-white/5 hover:bg-white/5 hover:border-white/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                selectedCustomer ? 'bg-primary/15 text-primary border-primary/20' : 'bg-white/5 text-slate-500 border-white/8'
              }`}>
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-bold text-white truncate">
                  {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
                </p>
                {selectedCustomer && (selectedCustomer as any).doc_nro && (
                  <p className="text-[10px] text-slate-500">{(selectedCustomer as any).doc_nro}</p>
                )}
              </div>
              {selectedCustomer ? (
                <span onClick={(e) => { e.stopPropagation(); setCustomerId(null) }}
                  className="w-6 h-6 rounded-md hover:bg-white/8 flex items-center justify-center text-slate-500 hover:text-red-400 transition">
                  <X className="w-3.5 h-3.5" />
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1.5 min-h-0 custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 select-none">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                  <ShoppingCart className="w-7 h-7 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-1">Tu venta está vacía</p>
                <p className="text-xs text-slate-600 text-center max-w-[200px]">
                  Buscá o escaneá un producto para comenzar.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const decimal = isDecimalUnit(item.product.unit)
                const unit = UNIT_SHORT[item.product.unit as ProductUnit] || item.product.unit
                const itemSubtotal = item.price * item.quantity
                return (
                  <div key={item.product.id} className="group bg-[#122238] border border-white/8 rounded-xl p-3.5 transition-all hover:border-white/10">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                        <Package className="w-[18px] h-[18px] text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white leading-snug truncate">{item.product.name}</p>
                          <button onClick={() => removeItem(item.product.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0 opacity-0 group-hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {formatCurrency(item.price)} <span className="text-slate-600">×</span> {item.quantity}{unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8">
                      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/8">
                        {decimal ? (
                          <input type="number" step="0.1" min="0.1" value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-14 h-7 text-center text-xs font-bold bg-transparent text-white focus:outline-none" />
                        ) : (
                          <>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/8 transition-colors active:scale-90">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold text-white tabular-nums">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors active:scale-90">
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums">
                        {formatCurrency(itemSubtotal)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Checkout footer */}
          {items.length > 0 && (
            <div className="shrink-0 px-4 pt-3 pb-4 border-t border-white/8 space-y-3">
              {/* Payment methods */}
              {!mixedPaymentMode && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Método de pago</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAYMENT_METHODS.map((pm) => {
                      const pmPct = pmDiscounts?.[pm.id] ?? 0
                      const isSelected = paymentMethod === pm.id
                      return (
                        <button key={pm.id} onClick={() => handleSelectPaymentMethod(pm.id)}
                          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold border transition-all active:scale-[0.97] min-h-[54px] ${
                            isSelected
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                          }`}>
                          {isSelected && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary" />}
                          <pm.icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                          <span className="leading-tight">{pm.label}</span>
                          {pmPct > 0 && <span className="text-[8px] font-bold text-primary">-{pmPct}%</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMixedPaymentMode(!mixedPaymentMode)}
                  className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-[0.97] ${
                    mixedPaymentMode
                      ? 'border-blue-500/25 bg-blue-500/8 text-blue-400'
                      : 'border-white/8 bg-white/5 text-slate-500 hover:text-white hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  {mixedPaymentMode ? <Check className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                  {mixedPaymentMode ? 'Pago mixto' : 'Dividir pago'}
                </button>
                <button
                  onClick={() => setShowReceiptModal(true)}
                  className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-[0.97] ${
                    receiptType !== 'ticket'
                      ? 'border-primary/20 bg-primary/8 text-primary'
                      : 'border-white/8 bg-white/5 text-slate-500 hover:text-white hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {receiptType === 'ticket' ? 'Ticket' : `${receiptType}`}
                </button>
              </div>

              {/* Mixed splits */}
              {mixedPaymentMode && (
                <div className="space-y-2 bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 animate-fade-in">
                  {mixedSplits.map((split, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={split.method} onChange={(e) => updateMixedSplit(i, 'method', e.target.value)}
                        className="h-9 px-2 rounded-lg border border-white/8 bg-[#0d1b2d] text-xs font-bold text-slate-400 focus:outline-none flex-1 min-w-0">
                        {PAYMENT_METHODS.map(pm => <option key={pm.id} value={pm.id} className="bg-[#07111f]">{pm.label}</option>)}
                      </select>
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">$</span>
                        <input type="number" value={split.amount || ''} onChange={(e) => updateMixedSplit(i, 'amount', e.target.value)}
                          className="w-full h-9 pl-5 pr-2 rounded-lg border border-white/8 bg-[#0d1b2d] text-xs font-bold text-right text-white focus:outline-none" placeholder="0" />
                      </div>
                      {mixedSplits.length > 2 && (
                        <button onClick={() => removeMixedSplit(i)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-400 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={addMixedSplit} className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">+ Agregar método</button>
                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${Math.abs(mixedRemaining) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.abs(mixedRemaining) < 0.01 ? '✓ Cubierto' : `Resta ${formatCurrency(mixedRemaining)}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-1.5 bg-[#122238] rounded-xl p-4 border border-white/8">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-white">{formatCurrency(subtotalRaw)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Descuento ({discount}%)</span>
                    <span className="font-semibold text-amber-400">-{formatCurrency(discountAmt)}</span>
                  </div>
                )}
                {currentPmDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Desc. efectivo ({currentPmDiscount}%)</span>
                    <span className="font-semibold text-primary">-{formatCurrency(afterDiscount * currentPmDiscount / 100)}</span>
                  </div>
                )}
                {surchargePct > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Recargo ({surchargePct}%)</span>
                    <span className="font-semibold text-blue-400">+{formatCurrency(surchargeAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 mt-2 border-t border-white/8">
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {formatCurrency(totalDisplay)}
                  </span>
                </div>
              </div>

              {/* Cobrar button */}
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={items.length === 0}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-lg shadow-primary/20 disabled:bg-white/8 disabled:text-slate-600 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <ShoppingCart className="w-5 h-5" />
                Cobrar {formatCurrency(totalDisplay)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ MOBILE ═══════════ */}
      {/* Bottom bar */}
      <div className="lg:hidden shrink-0 border-t border-white/8 bg-[#0d1b2d] px-3 py-2.5 safe-bottom">
        <button
          onClick={() => setShowCart(true)}
          className="w-full flex items-center gap-3 bg-[#122238] border border-white/8 rounded-xl px-4 py-3 hover:bg-[#1a2d3d] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4 text-primary" />
          </div>
          <span className="flex-1 text-left text-sm text-slate-400">
            {items.length === 0 ? 'Carrito vacío' : `${items.length} producto${items.length !== 1 ? 's' : ''}`}
          </span>
          {items.length > 0 && (
            <span className="text-base font-bold text-white tabular-nums">{formatCurrency(getTotal())}</span>
          )}
          <span
            onClick={(e) => { e.stopPropagation(); if (items.length > 0) setShowConfirmModal(true) }}
            className={`px-5 py-2 rounded-xl text-white text-sm font-bold transition-all shrink-0 ${
              items.length === 0 ? 'bg-primary/20 text-slate-500 cursor-not-allowed' : 'bg-primary shadow-sm shadow-primary/20 active:scale-95'
            }`}
          >
            Cobrar
          </span>
        </button>
      </div>

      {/* Mobile cart drawer */}
      {showCart && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCart(false)} />
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1b2d] border-t border-white/8 backdrop-blur-2xl rounded-t-2xl shadow-2xl animate-slide-in-up"
            style={{ maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex flex-col h-full">
              <div className="px-4 pt-2 pb-1 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-sm">Venta actual</span>
                      {items.length > 0 && (
                        <span className="ml-2 bg-primary/20 text-primary text-[9px] font-bold rounded-md px-1 py-0.5">
                          {items.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {items.length > 0 && (
                    <button onClick={clearCart} className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowCustomerModal(true)}
                  className="flex items-center gap-2 w-full p-2.5 rounded-xl border border-white/8 bg-white/5 hover:bg-white/5 transition-all text-left">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-white">{selectedCustomer?.name || 'Consumidor Final'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 ml-auto" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1.5 min-h-0">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
                    <ShoppingCart className="w-8 h-8 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400">Carrito vacío</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const decimal = isDecimalUnit(item.product.unit)
                    const unit = UNIT_SHORT[item.product.unit as ProductUnit] || item.product.unit
                    return (
                      <div key={item.product.id} className="bg-[#122238] border border-white/8 rounded-xl p-3">
                        <p className="text-sm font-semibold text-white truncate">{item.product.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatCurrency(item.price)} × {item.quantity}{unit}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/8">
                          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold text-white">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-primary transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-white">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {items.length > 0 && (
                <div className="shrink-0 px-4 pt-3 pb-4 space-y-3 border-t border-white/8">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Total</span>
                    <span className="text-xl font-bold text-white tabular-nums">{formatCurrency(getTotal())}</span>
                  </div>
                  <button onClick={() => setShowConfirmModal(true)}
                    className="w-full h-12 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                    <ShoppingCart className="w-5 h-5" />
                    Cobrar {formatCurrency(getTotal())}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      {/* Quantity input modal */}
      <Modal open={!!qtyInputProduct} onClose={() => setQtyInputProduct(null)} title="Cantidad" size="sm">
        {qtyInputProduct && (
          <div className="space-y-4">
            <div className="bg-[#122238] border border-white/8 rounded-xl p-3 text-center">
              <p className="font-semibold text-white">{qtyInputProduct.name}</p>
              <p className="text-sm text-slate-400 mt-1">{formatCurrency(qtyInputProduct.sale_price)} / {getUnitLabel(qtyInputProduct)}</p>
              <p className="text-xs text-slate-500">Stock: {qtyInputProduct.stock.toFixed(2)} {getUnitLabel(qtyInputProduct)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Cantidad ({getUnitLabel(qtyInputProduct)})</label>
              <input type="number" step="0.01" min="0.01" autoFocus value={qtyInputValue}
                onChange={(e) => setQtyInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmQtyInput() }}
                className="w-full h-12 px-4 rounded-xl border border-white/10 bg-[#0d1b2d] text-white text-lg font-bold text-center focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
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
          <p className="text-sm text-center text-slate-400">Apuntá la cámara al código de barras</p>
          <Button variant="outline" className="w-full" onClick={stopCameraScanner}>
            <X className="w-4 h-4" /> Cancelar
          </Button>
        </div>
      </Modal>

      {/* Customer modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Seleccionar cliente" size="sm">
        <input type="text" placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/20" />
        <div className="space-y-1.5 max-h-64 overflow-auto">
          <button onClick={() => { setCustomerId(null); setDocTipoCustomer('99'); setDocNroCustomer(''); setShowCustomerModal(false) }}
            className="w-full text-left p-3 rounded-xl border border-white/8 bg-white/5 hover:bg-white/8 text-sm font-medium text-white transition">
            Consumidor Final
          </button>
          {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
            <button key={c.id} onClick={() => { setCustomerId(c.id); setDocTipoCustomer((c as any).doc_tipo || '99'); setDocNroCustomer((c as any).doc_nro || ''); setShowCustomerModal(false) }}
              className={`w-full text-left p-3 rounded-xl border transition ${
                customerId === c.id ? 'border-primary/40 bg-primary/10' : 'border-white/8 bg-white/5 hover:bg-white/5'
              }`}>
              <p className="text-sm font-semibold text-white">{c.name}</p>
              {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
              {(c as any).doc_nro && <p className="text-[11px] text-slate-600">{DOC_TIPOS.find(d => String(d.id) === (c as any).doc_tipo)?.code}: {(c as any).doc_nro}</p>}
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
              <button key={rt.id} onClick={() => { if (!isDisabled) { setReceiptType(rt.id); setShowReceiptModal(false) } }} disabled={isDisabled}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isDisabled ? 'border-white/5 bg-white/5 opacity-40 cursor-not-allowed'
                    : receiptType === rt.id ? 'border-primary/40 bg-primary/10'
                    : 'border-white/8 bg-white/5 hover:bg-white/5'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    rt.id === 'ticket' ? 'bg-white/8 text-slate-300' :
                    rt.id === 'A' ? 'bg-blue-500/15 text-blue-400' :
                    rt.id === 'B' ? 'bg-green-500/15 text-green-400' :
                    'bg-purple-500/15 text-purple-400'
                  }`}>
                    {rt.id === 'ticket' ? <Receipt className="w-4 h-4" /> : rt.id}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{rt.label}</p>
                    <p className="text-xs text-slate-500">{isDisabled ? 'Configurá AFIP en Ajustes' : rt.desc}</p>
                  </div>
                  {receiptType === rt.id && !isDisabled && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                  )}
                </div>
              </button>
            )
          })}
          {!isFiscalConnected && (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/15 rounded-xl p-2.5 text-center mt-2">
              Las facturas A/B/C requieren conexión AFIP. Configurala en Ajustes.
            </p>
          )}
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar venta" size="sm">
        <div className="space-y-4">
          <div className="bg-[#122238] border border-white/8 rounded-xl p-4">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Productos</span>
                <span className="font-semibold text-white">{items.reduce((s, i) => s + i.quantity, 0)} {items.length === 1 ? getUnitLabel(items[0].product) : 'items'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Cliente</span>
                <span className="font-semibold text-white">{selectedCustomer?.name || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Medio de pago</span>
                <span className="font-semibold text-white">{mixedPaymentMode ? 'Pago mixto' : PAYMENT_LABELS[paymentMethod]}</span>
              </div>
              {mixedPaymentMode && mixedSplits.filter(s => s.amount > 0).map((s, i) => (
                <div key={i} className="flex justify-between text-xs pl-4">
                  <span className="text-slate-500">{PAYMENT_LABELS[s.method]}</span>
                  <span className="font-semibold text-white/80">{formatCurrency(s.amount)}</span>
                </div>
              ))}
              {!mixedPaymentMode && paymentMethod === 'credit' && installments > 1 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cuotas</span>
                  <span className="font-semibold text-white">{installments}x {formatCurrency(getTotal() / installments)} <span className="text-slate-500">(+{surchargePct}%)</span></span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Comprobante</span>
                <span className="font-semibold text-white">{receiptType === 'ticket' ? 'Ticket' : `Factura ${receiptType}`}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-amber-400/80">
                  <span>Descuento {discount}%</span>
                  <span className="font-semibold">-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              {surchargePct > 0 && (
                <div className="flex justify-between items-center text-blue-400/80">
                  <span>Recargo {surchargePct}%</span>
                  <span className="font-semibold">+{formatCurrency(surchargeAmt)}</span>
                </div>
              )}
              {receiptType === 'A' && (() => {
                const iva = calculateIVA('A', items, discount, surchargePct)
                return (
                  <>
                    <div className="flex justify-between text-xs text-blue-400/60">
                      <span>Neto gravado</span>
                      <span>{formatCurrency(iva.netoGravado)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-400/60">
                      <span>IVA 21%</span>
                      <span>{formatCurrency(iva.ivaAmount)}</span>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex justify-between items-center pt-3.5 mt-3.5 border-t border-white/8">
              <span className="text-lg font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(getTotal())}</span>
            </div>
          </div>

          {receiptType === 'A' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Tipo doc.</label>
                  <select value={docTipoCustomer} onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15">
                    {DOC_TIPOS.map(d => <option key={d.id} value={d.id} className="bg-[#07111f]">{d.code}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Nro. doc. *</label>
                  <input type="text" placeholder="20-12345678-9" value={docNroCustomer} onChange={(e) => setDocNroCustomer(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
                </div>
              </div>
            </div>
          )}
          {receiptType === 'B' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Tipo doc.</label>
                  <select value={docTipoCustomer} onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15">
                    {DOC_TIPOS.map(d => <option key={d.id} value={d.id} className="bg-[#07111f]">{d.code}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Nro. doc. (opc.)</label>
                  <input type="text" placeholder="DNI / CUIT" value={docNroCustomer} onChange={(e) => setDocNroCustomer(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
                </div>
              </div>
              <p className="text-[10px] text-slate-600">Para montos mayores a $22.850 AFIP puede requerir identificación</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowConfirmModal(false)}
              className="flex-1 h-12 rounded-xl border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/8 font-bold text-sm transition-all active:scale-[0.98]">
              Cancelar
            </button>
            <button onClick={handleConfirmSale} disabled={processing}
              className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                processing
                  ? 'bg-primary/50 text-white/70 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
              }`}>
              {processing ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/></svg> Procesando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Confirmar</>
              )}
            </button>
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

import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { quotesDb } from '@/lib/quotesDb'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { usePOSStore, isDecimalUnit, type PaymentMethodType, type ReceiptType, type PaymentSplit } from '@/stores/posStore'
import { useFiscalStore } from '@/stores/fiscalStore'
import { formatCurrency } from '@/lib/utils'
import { UNIT_SHORT, DOC_TIPOS, IVA_CONDITIONS, type ProductUnit } from '@/types/database'
import { requestCAE, calculateIVA, getCbteTipo } from '@/lib/afipService'
import { syncEngine } from '@/sync/syncEngine'
import { priceCart, type Promotion } from '@/features/promotions/promotionEngine'
import { hasPremiumAccess } from '@/hooks/usePlan'
import { exceedsCreditLimit } from '@/features/customers/creditScore'
import { combineDiscounts, pointsForPurchase, readLoyaltyConfig, type LoyaltyRedemption, type LoyaltyReward } from '@/features/loyalty/loyalty'
import LoyaltyRedeemPanel from '@/features/loyalty/LoyaltyRedeemPanel'
import QrPaymentModal from '@/features/mpQr/QrPaymentModal'
import { mpQr } from '@/features/mpQr/mpQrService'
import { getLocalCustomers, getLocalProducts, getLocalRows } from '@/sync/storage'
import CameraScanner, { type ScanFeedback } from '@/features/scanner/CameraScanner'
import { findScannedProduct } from '@/features/scanner/scanLookup'
import { findProductWithScaleSupport, parseSistelBarcode } from '@/features/scanner/sistelScale'
import { localStock, stockByProduct, type WarehouseStockRow } from '@/features/warehouses/warehouseStock'
import { isOnline, onConnectivityChange, withSyncNote } from '@/sync/connectivity'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import PostSaleModal, { type PostSaleData } from '@/components/PostSaleModal'
import SubscriptionBadge from '@/features/subscription/components/SubscriptionBadge'
import { CajaGoIcon } from '@/components/brand/CajaGoBrand'
import type { Product, Customer, CartItem } from '@/types/database'
import {
  Search, Tag, QrCode, Scale, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, ArrowRightLeft, X, CheckCircle2, User, UserPlus, Wallet,
  FileText, Receipt, Percent, CircleDollarSign, Camera, ChevronRight, Check, Package,
  LogOut, Zap, ScanLine, ChevronDown, Coffee,
} from 'lucide-react'
import EmployeeConsumptionModal from '@/features/stock/EmployeeConsumptionModal'
import { isSellerJr, requireManagerFor } from '@/features/roles/managerApproval'

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

interface POSPaymentOption {
  key: string
  method: PaymentMethodType
  label: string
  icon: typeof Banknote
  isCashDiscount?: boolean
  isCashPlain?: boolean
}

const POS_PAYMENT_OPTIONS: POSPaymentOption[] = [
  { key: 'cash_discount', method: 'cash', label: 'Efectivo', icon: Banknote, isCashDiscount: true },
  { key: 'cash_plain', method: 'cash', label: 'Efectivo solo', icon: Banknote, isCashPlain: true },
  { key: 'debit', method: 'debit', label: 'Débito', icon: CreditCard },
  { key: 'credit', method: 'credit', label: 'Crédito', icon: CreditCard },
  { key: 'transfer', method: 'transfer', label: 'Transfer.', icon: ArrowRightLeft },
  { key: 'account', method: 'account', label: 'Cta. Cte.', icon: CircleDollarSign },
]

// Solo aparece si el negocio conectó su Mercado Pago (Premium) y hay conexión.
const QR_PAYMENT_OPTION: POSPaymentOption = { key: 'qr', method: 'qr', label: 'QR Mercado Pago', icon: QrCode }

const RECEIPT_TYPES: { id: ReceiptType; label: string; desc: string }[] = [
  { id: 'ticket', label: 'Recibo', desc: 'Documento no fiscal, en A4' },
  { id: 'A', label: 'Factura A', desc: 'Resp. Inscripto' },
  { id: 'B', label: 'Factura B', desc: 'Consumidor Final' },
  { id: 'C', label: 'Factura C', desc: 'Monotributo' },
]

/** Estado del certificado, en palabras que se entiendan en el POS. */
const CERT_STATUS_LABELS: Record<string, string> = {
  missing: 'sin iniciar',
  csr_generated: 'pedido generado, falta subir el certificado de AFIP',
  crt_uploaded: 'certificado subido, falta probar la conexión',
  connected: 'conectada',
}

const CUOTA_OPTIONS = [
  { n: 1, label: '1 pago', surcharge: 0 },
  { n: 3, label: '3 cuotas', surcharge: 15 },
  { n: 6, label: '6 cuotas', surcharge: 25 },
  { n: 12, label: '12 cuotas', surcharge: 40 },
]

const PAYMENT_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Efectivo', debit: 'Tarjeta Débito', credit: 'Tarjeta Crédito',
  transfer: 'Transferencia', account: 'Cuenta Corriente', qr: 'QR Mercado Pago',
}

export default function POSPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const {
    items, discount, paymentMethod, customerId, sourceQuoteId,
    receiptType, installments, surchargePct, pmDiscountPct, paymentSplits,
    addItem, removeItem, updateQuantity, setDiscount,
    setPaymentMethod, setCustomerId, getSubtotal, getTotal, clearCart,
    setReceiptType, setInstallments, setSurchargePct, setPmDiscountPct, setPaymentSplits,
    promotions, setPromotions, getSaleLines, getPromoDiscount,
    loyaltyRedemption, setLoyaltyRedemption,
  } = usePOSStore()
  // Club de puntos (Premium): configuración del negocio y premios para canjear.
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([])
  // Cobro con QR de Mercado Pago (Premium): se habilita si el negocio tiene la caja configurada.
  const [qrReady, setQrReady] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const qrPaidOrderRef = useRef<string | null>(null)
  const qrSaleIdRef = useRef<string | null>(null)
  const { business } = useBusinessStore()
  const loyaltyConfig = useMemo(() => readLoyaltyConfig((business as any)?.loyalty_config), [business])
  // Promociones aplicadas a cada ítem del carrito (para mostrarlas; la venta usa getSaleLines).
  const pricedCart = useMemo(() => priceCart(items, promotions), [items, promotions])
  const promoByProduct = useMemo(
    () => new Map(pricedCart.items.map(entry => [entry.item.product.id, entry])),
    [pricedCart]
  )
  const fiscalCertStatus = useFiscalStore((s) => s.settings?.cert_status)
  const isFiscalConnected = fiscalCertStatus === 'connected'
  const fiscalEnv = useFiscalStore((s) => s.env)
  const fetchFiscalSettings = useFiscalStore((s) => s.fetchSettings)

  // La config fiscal solo la cargaba SettingsPage, asi que entrando directo al
  // POS cert_status quedaba undefined y las facturas aparecian deshabilitadas.
  useEffect(() => {
    if (profile?.business_id) fetchFiscalSettings(profile.business_id)
  }, [profile?.business_id])

  // Con AFIP conectado se factura por defecto, con la letra que corresponde a
  // la condición de IVA del negocio. Sin elección previa el POS arrancaba
  // siempre en Recibo y habia que cambiarlo a mano en cada venta.
  useEffect(() => {
    if (!isFiscalConnected || !business) return
    if (localStorage.getItem('stockia_receipt_type')) return
    setReceiptType(business.iva_condition === 'responsable_inscripto' ? 'B' : 'C')
  }, [isFiscalConnected, business?.iva_condition])

  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showConsumption, setShowConsumption] = useState(false)
  // Bajar a 0 quita el producto: el Vendedor Jr necesita el código de encargado.
  async function changeQuantity(productId: string, quantity: number, typing = false) {
    if (quantity <= 0 && isSellerJr()) {
      if (typing || !(await requireManagerFor('Quitar un producto'))) return
    }
    updateQuantity(productId, quantity)
  }
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
  const [customerNameInput, setCustomerNameInput] = useState('')
  const [customerPhoneInput, setCustomerPhoneInput] = useState('')
  const [customerIvaCondition, setCustomerIvaCondition] = useState('consumidor_final')
  const [saveCustomerCheck, setSaveCustomerCheck] = useState(true)
  const [showQuickCustomerForm, setShowQuickCustomerForm] = useState(false)
  const [accountNote, setAccountNote] = useState('')
  const [qtyInputProduct, setQtyInputProduct] = useState<Product | null>(null)
  const [qtyInputValue, setQtyInputValue] = useState('')
  const [postSaleData, setPostSaleData] = useState<PostSaleData | null>(null)
  const [lastSaleHadCae, setLastSaleHadCae] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cameraContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.business_id) {
      syncEngine.init().then(() => Promise.all([
        fetchProducts(),
        fetchCustomers(),
        checkCajaOpen(),
        fetchPromotions(),
      ]), (error) => {
        console.error('[POS] local database initialization failed:', error)
        toast.error(`No se pudo abrir la base local (${error?.message || error}). Reiniciá CajaGo antes de vender.`, { duration: 15000 })
      }).catch((error) => {
        console.warn('[POS] initial load failed:', error)
        toast.error('No se pudieron cargar productos o clientes. Revisá la conexión y volvé a entrar al POS.')
      })
    }
  }, [profile?.business_id])

  useEffect(() => {
    if (!profile?.business_id) return
    const refreshAfterReconnect = () => {
      fetchProducts()
      fetchCustomers()
      checkCajaOpen()
      fetchPromotions()
    }
    const offConnectivity = onConnectivityChange(online => { if (online) refreshAfterReconnect() })
    const offSynced = syncEngine.onSynced(refreshAfterReconnect)
    return () => { offConnectivity(); offSynced() }
  }, [profile?.business_id])

  useEffect(() => { searchRef.current?.focus() }, [])

  // El canje es del cliente elegido: si cambia de cliente, se deshace.
  useEffect(() => {
    if (usePOSStore.getState().loyaltyRedemption) removeRedemption()
  }, [customerId])

  // Pos keyboard shortcuts & state ref to prevent stale closures
  const posStateRef = useRef({
    items,
    showConfirmModal,
    showCustomerModal,
    showReceiptModal,
    qtyInputProduct,
    showCameraScanner,
    search,
    processing,
    handleConfirmSale,
    stopCameraScanner,
  })

  useEffect(() => {
    posStateRef.current = {
      items,
      showConfirmModal,
      showCustomerModal,
      showReceiptModal,
      qtyInputProduct,
      showCameraScanner,
      search,
      processing,
      handleConfirmSale,
      stopCameraScanner,
    }
  })

  // Keyboard shortcuts in POS (Always operational regardless of focus)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const state = posStateRef.current

      // ── F1 & F2: Buscar producto (enfocar y seleccionar buscador) ──
      if (e.key === 'F1' || e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      // ── F4: Seleccionar cliente ──
      if (e.key === 'F4') {
        e.preventDefault()
        setShowCustomerModal(prev => !prev)
        return
      }

      // ── F8: Cobrar venta ──
      if (e.key === 'F8') {
        e.preventDefault()
        if (state.showConfirmModal) {
          if (!state.processing) state.handleConfirmSale()
        } else if (state.items.length > 0) {
          setShowConfirmModal(true)
        } else {
          toast.info('Agregá al menos un producto para cobrar')
        }
        return
      }

      // ── Enter: Confirmar en modal de cobro o cerrar recibo ──
      if (e.key === 'Enter') {
        if (state.showConfirmModal && !state.processing) {
          e.preventDefault()
          state.handleConfirmSale()
          return
        }
        if (state.showReceiptModal) {
          e.preventDefault()
          setShowReceiptModal(false)
          searchRef.current?.focus()
          return
        }
      }

      // ── Escape: Jerarquía intuitiva de cancelación ──
      if (e.key === 'Escape') {
        e.preventDefault()
        if (state.showConfirmModal) {
          setShowConfirmModal(false)
          searchRef.current?.focus()
          return
        }
        if (state.showCustomerModal) {
          setShowCustomerModal(false)
          setShowQuickCustomerForm(false)
          searchRef.current?.focus()
          return
        }
        if (state.showReceiptModal) {
          setShowReceiptModal(false)
          searchRef.current?.focus()
          return
        }
        if (state.qtyInputProduct) {
          setQtyInputProduct(null)
          searchRef.current?.focus()
          return
        }
        if (state.showCameraScanner) {
          state.stopCameraScanner()
          searchRef.current?.focus()
          return
        }

        // Si hay texto en el buscador, limpiarlo
        if (state.search) {
          setSearch('')
          searchRef.current?.focus()
          return
        }

        // Si no hay nada abierto ni texto en búsqueda, volver al Inicio
        navigate('/menu')
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

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
    const scan = findProductWithScaleSupport(code, products, findScannedProduct)
    const { product } = scan
    if (product) {
      if (scan.isScale && scan.scaleWeight) {
        addItem(product, scan.scaleWeight)
        playBeep()
        toast.success(`${product.name} (${scan.scaleWeight} kg) agregado`)
      } else if (isDecimalUnit(product.unit)) {
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

  /**
   * Escáner con cámara: no se cierra después de cada lectura. Suma 1 por cada lectura del mismo producto
   * y respeta stock (el del local, sin lo que está en depósitos), precios mayoristas y promociones.
   */
  async function handleCameraScan(code: string): Promise<ScanFeedback> {
    const scan = findProductWithScaleSupport(code, products, findScannedProduct)
    const { product, code: shown, isProductLink } = scan
    if (!product) {
      const canCreate = profile?.role !== 'seller_jr' && !isProductLink
      return {
        ok: false,
        message: 'Producto no encontrado',
        detail: isProductLink || shown.length > 40 ? 'Ese QR no corresponde a un producto de tu negocio' : `Código ${shown}`,
        action: canCreate && shown.length <= 40
          ? { label: 'Crear producto con este código', run: () => { setShowCameraScanner(false); navigate(`/products?nuevo=${encodeURIComponent(shown)}`) } }
          : undefined,
      }
    }
    if (scan.isScale && scan.scaleWeight) {
      addItem(product, scan.scaleWeight)
      playBeep()
      return { ok: true, message: product.name, detail: `${scan.scaleWeight} kg agregados`, close: false }
    }
    if (isDecimalUnit(product.unit)) {
      setQtyInputProduct(product)
      setQtyInputValue('1')
      return { ok: true, message: product.name, detail: 'Indicá la cantidad', close: true }
    }

    const inCart = usePOSStore.getState().items.find((item) => item.product.id === product.id)?.quantity ?? 0
    const warehouseRows = await getLocalRows<WarehouseStockRow>('warehouse_stock', profile!.business_id).catch(() => [])
    const available = localStock(product.stock, stockByProduct(warehouseRows).get(product.id))
    if (inCart + 1 > available) {
      const stored = product.stock - available
      return {
        ok: false,
        message: product.name,
        detail: stored > 0 && product.stock > inCart ? `Sin stock en el local (${stored} en depósitos)` : `Sin stock suficiente (hay ${product.stock})`,
      }
    }
    addItem(product)
    const now = usePOSStore.getState().items.find((item) => item.product.id === product.id)
    if (!now || now.quantity === inCart) return { ok: false, message: product.name, detail: `Sin stock suficiente (hay ${product.stock})` }
    return { ok: true, message: product.name, detail: `En la venta: ${now.quantity} · ${formatCurrency(now.price)} c/u` }
  }

  function startCameraScanner() { setShowCameraScanner(true) }
  function stopCameraScanner() { setShowCameraScanner(false) }

  async function fetchProducts() {
    const cached = await getLocalProducts(profile!.business_id)
    if (cached.length > 0) setProducts(cached as Product[])

    if (!isOnline()) {
      if (cached.length > 0) toast.info(`Modo offline: ${cached.length} productos disponibles`)
      return
    }

    const freshProducts = await syncEngine.pullLatestProducts(profile!.business_id)
    if (freshProducts.length > 0) setProducts(freshProducts as Product[])
  }
  async function fetchCustomers() {
    const cached = await getLocalCustomers(profile!.business_id)
    if (cached.length > 0) setCustomers(cached as Customer[])
    if (!isOnline()) return
    const freshCustomers = await syncEngine.pullLatestCustomers(profile!.business_id)
    if (freshCustomers.length > 0) setCustomers(freshCustomers as Customer[])
  }
  // Promociones: solo con plan Premium (o en la prueba). Se guardan en la base local.
  async function fetchPromotions() {
    const businessId = profile!.business_id
    if (hasPremiumAccess(useBusinessStore.getState().business)) {
      const rows = await syncEngine.pullRows<Promotion>('promotions', businessId, () =>
        (supabase as any).from('promotions').select('*').eq('business_id', businessId))
      setPromotions(rows)
    } else {
      setPromotions([])
    }
    const rewards = await syncEngine.pullRows<LoyaltyReward>('loyalty_rewards', businessId, () =>
      (supabase as any).from('loyalty_rewards').select('*').eq('business_id', businessId))
    setLoyaltyRewards(rewards)
    if (isOnline()) mpQr.status().then(status => setQrReady(status.connected && status.pos_ready)).catch(() => setQrReady(false))
  }

  function onQrPaid(orderId: string) {
    qrPaidOrderRef.current = orderId
    setShowQrModal(false)
    // Con el pago confirmado se registra la venta; los refs se limpian al terminar.
    handleConfirmSale().finally(() => { qrPaidOrderRef.current = null; qrSaleIdRef.current = null })
  }

  // Suma los puntos de la compra y descuenta los del premio canjeado (queda en la cola si no hay conexión).
  async function recordLoyaltyAfterSale(saleCustomerId: string | null, saleId: string, saleTotal: number, redemption: LoyaltyRedemption | null) {
    if (!saleCustomerId || !loyaltyConfig.enabled) return
    try {
      const businessId = profile!.business_id
      if (redemption) {
        await syncEngine.recordLoyaltyMovement(businessId, { customer_id: saleCustomerId, sale_id: saleId, points: -redemption.points, kind: 'redeem', description: `Canje: ${redemption.name}` })
      }
      const earned = pointsForPurchase(saleTotal, loyaltyConfig)
      if (earned > 0) {
        await syncEngine.recordLoyaltyMovement(businessId, { customer_id: saleCustomerId, sale_id: saleId, points: earned, kind: 'earn', description: 'Compra' })
        toast.success(`+${earned} punto${earned !== 1 ? 's' : ''} para el cliente`)
      }
      fetchCustomers()
    } catch (error) {
      console.warn('[POS] no se pudieron registrar los puntos:', error)
    }
  }

  function redeemReward(reward: LoyaltyReward) {
    if (reward.kind === 'percent' && reward.percent) {
      setLoyaltyRedemption({ rewardId: reward.id, name: reward.name, points: reward.points_cost, kind: 'percent', percent: reward.percent, previousDiscount: discount })
      setDiscount(combineDiscounts(discount, reward.percent))
    } else {
      setLoyaltyRedemption({ rewardId: reward.id, name: reward.name, points: reward.points_cost, kind: 'product', productId: reward.product_id })
    }
  }

  function removeRedemption() {
    if (loyaltyRedemption?.kind === 'percent') setDiscount(loyaltyRedemption.previousDiscount ?? 0)
    setLoyaltyRedemption(null)
  }

  /** Puntos del cliente y premios para canjear: se ve apenas se elige el cliente (y de nuevo al confirmar). */
  function renderLoyaltyPanel() {
    if (!selectedCustomer || !loyaltyConfig.enabled) return null
    return (
      <LoyaltyRedeemPanel
        customerName={selectedCustomer.name}
        customerPoints={Number((selectedCustomer as any).loyalty_points) || 0}
        config={loyaltyConfig}
        rewards={loyaltyRewards}
        cartProductIds={items.map(item => item.product.id)}
        total={getTotal()}
        redemption={loyaltyRedemption}
        onRedeem={redeemReward}
        onRemove={removeRedemption}
      />
    )
  }

  async function checkCajaOpen() {
    const businessId = profile!.business_id
    const sessions = await syncEngine.pullRows<{ id: string; status: string }>('cash_sessions', businessId, () =>
      supabase.from('cash_sessions').select('*').eq('business_id', businessId).order('opened_at', { ascending: false })
    )
    setCajaOpen(sessions.some(session => session.status === 'open'))
  }

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const term = search.trim()
    const q = term.toLowerCase()
    const scale = parseSistelBarcode(term)

    return products.filter((p) => {
      if (scale) {
        const codeStr = String((p as any).code || '').trim().toLowerCase()
        const barcodeStr = String(p.barcode || '').trim().toLowerCase()
        if (
          codeStr === scale.plu.toLowerCase() ||
          codeStr === scale.pluRaw.toLowerCase() ||
          codeStr === scale.plu4Raw.toLowerCase() ||
          barcodeStr === scale.plu.toLowerCase() ||
          barcodeStr === scale.pluRaw.toLowerCase() ||
          barcodeStr === scale.plu4Raw.toLowerCase() ||
          barcodeStr === scale.raw ||
          barcodeStr.endsWith(scale.plu)
        ) {
          return true
        }
      }
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        ((p as any).code && String((p as any).code).toLowerCase() === q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))
      )
    })
  }, [products, search])

  const visibleProducts = useMemo(() => filteredProducts.slice(0, 48), [filteredProducts])

  // Show first 12 products when no search → "Venta rápida"
  const quickProducts = useMemo(() => {
    if (search) return []
    return products.slice(0, 12)
  }, [products, search])

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      const term = search.trim()

      // 1. Sistel scale barcode lookup
      const scan = findProductWithScaleSupport(term, products, findScannedProduct)
      if (scan.product) {
        if (scan.isScale && scan.scaleWeight) {
          addItem(scan.product, scan.scaleWeight)
          playBeep()
          toast.success(`${scan.product.name} (${scan.scaleWeight} kg) agregado`)
        } else {
          handleProductClick(scan.product)
        }
        setSearch('')
        return
      }

      // 2. Exact code or barcode match
      const typed = term.toLowerCase()
      const exactMatch = products.find(p => String((p as any).code || '').toLowerCase() === typed) ?? products.find(p => p.barcode === term)
      if (exactMatch) {
        handleProductClick(exactMatch)
        setSearch('')
        return
      }

      // 3. Single filtered item
      if (filteredProducts.length === 1) {
        handleProductClick(filteredProducts[0])
        setSearch('')
        return
      }

      // 4. Detected Sistel barcode but product not registered yet
      const scaleParsed = parseSistelBarcode(term)
      if (scaleParsed) {
        toast.info(`Balanza Sistel: PLU ${scaleParsed.plu} (${scaleParsed.weightKg} kg). Creá el producto con código ${scaleParsed.plu} para pesarlo directo.`, {
          duration: 6000,
        })
      }
    }
  }

  function handleProductClick(product: Product) {
    // Always open the quantity input so the user can type a manual amount
    // or confirm the default 1 unit. This enables fully manual entries like "pioner 30".
    setQtyInputProduct(product)
    setQtyInputValue('1')
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

  function handleSelectCustomer(c: Customer | null) {
    if (c) {
      setCustomerId(c.id)
      usePOSStore.getState().setWholesaleCustomer(!!(c as any).is_wholesale)
      setCustomerNameInput(c.name || '')
      setCustomerPhoneInput(c.phone || '')
      setDocTipoCustomer((c as any).doc_tipo ? String((c as any).doc_tipo) : '80')
      setDocNroCustomer((c as any).doc_nro || '')
      setCustomerIvaCondition((c as any).iva_condition || 'consumidor_final')
    } else {
      setCustomerId(null)
      usePOSStore.getState().setWholesaleCustomer(false)
      setCustomerNameInput('')
      setCustomerPhoneInput('')
      setDocTipoCustomer(receiptType === 'A' ? '80' : '99')
      setDocNroCustomer('')
      setCustomerIvaCondition('consumidor_final')
      setSaveCustomerCheck(true)
    }
  }

  async function handleCreateAndSelectCustomer() {
    const name = customerNameInput.trim()
    if (!name) {
      toast.error('Ingresá el nombre o razón social del cliente')
      return
    }
    const cleanDoc = docNroCustomer.replace(/[^0-9]/g, '')
    const newCustomer = {
      id: crypto.randomUUID(),
      business_id: profile!.business_id,
      name,
      phone: customerPhoneInput.trim() || null,
      email: null,
      address: null,
      doc_tipo: docTipoCustomer || '99',
      doc_nro: cleanDoc || null,
      iva_condition: customerIvaCondition || 'consumidor_final',
      balance: 0,
      created_at: new Date().toISOString(),
    }

    try {
      await syncEngine.createRow('customers', profile!.business_id, newCustomer)
      setCustomers(prev => [...prev, newCustomer as Customer])
      handleSelectCustomer(newCustomer as Customer)
      setShowQuickCustomerForm(false)
      setShowCustomerModal(false)
      toast.success(withSyncNote(`Cliente "${name}" guardado y seleccionado`))
    } catch (e: any) {
      console.error('[POS] Error guardando cliente:', e)
      toast.error(e?.message || 'No se pudo guardar el cliente')
    }
  }

  function handleDocNroChange(val: string) {
    setDocNroCustomer(val)
    const clean = val.replace(/[^0-9]/g, '')
    if (clean.length === 11 && (docTipoCustomer === '99' || docTipoCustomer === '96')) {
      setDocTipoCustomer('80')
      if (customerIvaCondition === 'consumidor_final') {
        if (clean.startsWith('30') || clean.startsWith('33')) {
          setCustomerIvaCondition('responsable_inscripto')
        } else {
          setCustomerIvaCondition('monotributo')
        }
      }
    } else if ((clean.length === 7 || clean.length === 8) && docTipoCustomer === '99') {
      setDocTipoCustomer('96')
    } else if (clean.length === 0 && receiptType !== 'A') {
      setDocTipoCustomer('99')
      setCustomerIvaCondition('consumidor_final')
    }
  }

  useEffect(() => {
    if (customerId) {
      const c = customers.find(cust => cust.id === customerId)
      if (c) {
        setCustomerNameInput(c.name || '')
        setDocTipoCustomer((c as any).doc_tipo ? String((c as any).doc_tipo) : '80')
        setDocNroCustomer((c as any).doc_nro || '')
        setCustomerIvaCondition((c as any).iva_condition || 'consumidor_final')
      }
    }
  }, [customerId, customers])

  function handleSelectCuota(opt: typeof CUOTA_OPTIONS[number]) {
    setInstallments(opt.n)
    setSurchargePct(opt.surcharge)
  }

  function handleSelectPaymentOption(opt: POSPaymentOption) {
    setPaymentMethod(opt.method)
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    if (opt.isCashPlain) {
      setPmDiscountPct(0)
    } else if (opt.isCashDiscount) {
      const pct = discounts?.cash ?? 10
      setPmDiscountPct(pct)
    } else {
      const pct = discounts?.[opt.method] ?? 0
      setPmDiscountPct(pct)
    }
  }

  function handleSelectPaymentMethod(method: PaymentMethodType) {
    setPaymentMethod(method)
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    const pct = discounts?.[method] ?? 0
    setPmDiscountPct(pct)
  }

  useEffect(() => {
    const discounts = (business as any)?.payment_method_discounts as Record<string, number> | null
    if (paymentMethod === 'cash') {
      // Si el porcentaje actual es > 0, actualizarlo al configurado para cash (o 10)
      if (pmDiscountPct > 0) {
        setPmDiscountPct(discounts?.cash ?? 10)
      }
    } else {
      const pct = discounts?.[paymentMethod] ?? 0
      setPmDiscountPct(pct)
    }
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
    if (!mixedPaymentMode && paymentMethod === 'qr') {
      if (!isOnline()) { toast.error('El cobro con QR necesita conexión. Elegí otro medio de pago.'); return }
      // Primero se cobra el QR; cuando Mercado Pago confirma, se registra la venta (ver onQrPaid).
      if (!qrPaidOrderRef.current) {
        qrSaleIdRef.current = crypto.randomUUID()
        setShowQrModal(true)
        return
      }
    }
    if (receiptType !== 'ticket' && !isFiscalConnected) {
      toast.error('AFIP no está configurado. Andá a Configuración → Facturación AFIP para completar el wizard.'); return
    }

    const cleanDoc = docNroCustomer.replace(/[^0-9]/g, '')
    let docTipoNum = Number(docTipoCustomer) || 99
    let docNro = cleanDoc

    if (!cleanDoc || cleanDoc === '0') {
      if (receiptType === 'A') {
        toast.error('Ingresá el CUIT del cliente para Factura A')
        return
      }
      docTipoNum = 99
      docNro = '0'
    } else {
      if (docTipoNum === 99) {
        docTipoNum = cleanDoc.length === 11 ? 80 : 96
      }
      if (receiptType === 'A') {
        docTipoNum = 80
      }
    }

    const resolvedCustomerName = customerNameInput.trim() || selectedCustomer?.name || (cleanDoc && cleanDoc !== '0' ? (docTipoNum === 80 ? `Cliente CUIT ${cleanDoc}` : `Cliente DNI ${cleanDoc}`) : 'Consumidor Final')

    if (receiptType === 'A') {
      if (cleanDoc.length !== 11) {
        toast.error('El CUIT debe tener 11 dígitos para Factura A')
        return
      }
      if (!customerNameInput.trim() && !selectedCustomer?.name) {
        toast.error('Ingresá el nombre o razón social del cliente para Factura A')
        return
      }
    }

    if (mixedPaymentMode && Math.abs(mixedRemaining) > 0.01) {
      toast.error('Los montos del pago mixto no coinciden con el total'); return
    }

    // Límite de crédito del cliente para ventas a cuenta (Premium; 0 = sin límite).
    const accountCharge = mixedPaymentMode
      ? (mixedSplits.find(s => s.method === 'account')?.amount || 0)
      : (paymentMethod === 'account' ? getTotal() : 0)
    const creditCustomer = customers.find(c => c.id === customerId)
    if (accountCharge > 0 && creditCustomer && hasPremiumAccess(useBusinessStore.getState().business)) {
      const limit = Number((creditCustomer as any).credit_limit) || 0
      const balance = Number(creditCustomer.balance) || 0
      if (exceedsCreditLimit(balance, limit, accountCharge)) {
        toast.error(`${creditCustomer.name} supera su límite de crédito: debe ${formatCurrency(balance)} y el límite es ${formatCurrency(limit)}. Disponible: ${formatCurrency(Math.max(0, limit - balance))}.`, { duration: 8000 })
        return
      }
    }
    setProcessing(true)
    try {
      const total = getTotal()
      const primaryPayment = mixedPaymentMode ? 'mixed' : paymentMethod
      // Renglones de la venta con las promociones ya aplicadas (unidades bonificadas a $0).
      const saleLines = getSaleLines()

      if (!isOnline() && receiptType !== 'ticket') {
        toast.error('Sin conexión: solo se pueden hacer ventas con Ticket')
        setProcessing(false); return
      }

      const qrOrderId = paymentMethod === 'qr' ? qrPaidOrderRef.current : null
      const qrNote = qrOrderId ? `QR Mercado Pago ${qrOrderId}` : null
      if (receiptType === 'ticket') {
        const localSaleId = (qrOrderId && qrSaleIdRef.current) || crypto.randomUUID()
        const createdAt = new Date().toISOString()
        const subtotalRaw = getSubtotal()
        const afterDiscount = subtotalRaw - (subtotalRaw * discount) / 100
        const surchargeAmt = (afterDiscount * surchargePct) / 100
        const stockUpdates = items.map(item => ({
          productId: item.product.id,
          newStock: Math.round((item.product.stock - item.quantity) * 1000) / 1000,
          qty: item.quantity,
          movementId: crypto.randomUUID(),
        }))
        const accountAmount = mixedPaymentMode
          ? (mixedSplits.find(s => s.method === 'account')?.amount || 0)
          : (paymentMethod === 'account' ? total : 0)
        const customerToCreate = saveCustomerCheck && !customerId && resolvedCustomerName !== 'Consumidor Final'
          ? {
              id: crypto.randomUUID(),
              business_id: profile!.business_id,
              name: resolvedCustomerName,
              phone: customerPhoneInput.trim() || null,
              email: null,
              address: null,
              doc_tipo: String(docTipoNum),
              doc_nro: cleanDoc || null,
              iva_condition: customerIvaCondition || 'consumidor_final',
              balance: 0,
              created_at: createdAt,
            }
          : undefined
        const localCustomerId = customerId || customerToCreate?.id || null

        await syncEngine.queueOfflineSale({
          customerToCreate,
          sale: {
            id: localSaleId,
            business_id: profile!.business_id,
            customer_id: localCustomerId,
            total,
            discount,
            payment_method: primaryPayment,
            seller_id: profile!.id,
            receipt_type: 'ticket',
            installments,
            surcharge_pct: surchargePct,
            note: [accountNote.trim(), qrNote].filter(Boolean).join(' · ') || null,
            fiscal_status: 'pending',
            device_id: '',
            created_at: createdAt,
          },
          items: saleLines.map(item => ({
            id: crypto.randomUUID(),
            sale_id: localSaleId,
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.price,
            cost_at_sale: item.product.avg_cost || item.product.purchase_price || 0,
          })),
          payments: (mixedPaymentMode
            ? mixedSplits.filter(split => split.amount > 0).map(split => ({ payment_method: split.method, amount: split.amount }))
            : [{ payment_method: paymentMethod, amount: total }]
          ).map(payment => ({ id: crypto.randomUUID(), sale_id: localSaleId, ...payment })),
          stockUpdates,
          accountUpdate: accountAmount > 0 && localCustomerId
            ? { customerId: localCustomerId, amount: accountAmount }
            : undefined,
        })

        setLastSaleId(localSaleId)
        recordLoyaltyAfterSale(localCustomerId, localSaleId, total, loyaltyRedemption)
        if (customerToCreate) setCustomers(previous => [...previous, customerToCreate as Customer])
        setProducts(previous => previous.map(product => {
          const update = stockUpdates.find(item => item.productId === product.id)
          return update ? { ...product, stock: Math.max(0, update.newStock) } : product
        }))

        const business = useBusinessStore.getState().business
        setPostSaleData({
          businessName: business?.name || 'Mi Negocio',
          businessAddress: business?.address,
          businessPhone: business?.phone,
          businessEmail: business?.email,
          businessCuit: business?.cuit,
          receiptType: 'ticket',
          items: [...saleLines],
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

        clearCart(); setShowConfirmModal(false); setShowSuccess(true); setShowTicketModal(true)
        setMixedPaymentMode(false); setMixedSplits([{ method: 'cash', amount: 0 }, { method: 'debit', amount: 0 }])
        toast.success(isOnline()
          ? 'Venta guardada localmente · Sincronizando'
          : 'Venta guardada offline · Se sincronizará al reconectar')
        playBeep()
        setTimeout(() => setShowSuccess(false), 2500)
        setProcessing(false)
        return
      }

      let finalCustomerId = customerId
      if (saveCustomerCheck && !customerId && resolvedCustomerName && resolvedCustomerName !== 'Consumidor Final') {
        try {
          const newCust = {
            id: crypto.randomUUID(),
            business_id: profile!.business_id,
            name: resolvedCustomerName,
            phone: customerPhoneInput.trim() || null,
            email: null,
            address: null,
            doc_tipo: String(docTipoNum),
            doc_nro: cleanDoc || null,
            iva_condition: customerIvaCondition || 'consumidor_final',
            balance: 0,
            created_at: new Date().toISOString(),
          }
          await syncEngine.createRow('customers', profile!.business_id, newCust)
          finalCustomerId = newCust.id
          setCustomers(prev => [...prev, newCust as Customer])
        } catch (e) {
          console.warn('No se pudo guardar el cliente en la base de datos:', e)
        }
      }

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: profile!.business_id,
          customer_id: finalCustomerId,
          total,
          discount,
          payment_method: primaryPayment,
          seller_id: profile!.id,
          receipt_type: receiptType,
          installments,
          surcharge_pct: surchargePct,
          ...(accountNote.trim() && paymentMethod === 'account' && !mixedPaymentMode ? { note: accountNote.trim() } : {}),
          ...(qrNote ? { note: qrNote } : {}),
        })
        .select().single()

      if (saleError || !sale) { toast.error('Error al crear la venta'); setProcessing(false); return }

      const saleItems = saleLines.map((item) => ({
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
        const { error: accountError } = await (supabase as any).rpc('charge_customer_account', {
          p_business_id: profile!.business_id,
          p_customer_id: customerId,
          p_amount: total,
          p_sale_id: sale.id,
          p_user_id: profile!.id,
        })
        if (accountError) throw accountError
      }
      if (mixedPaymentMode) {
        const accountSplit = mixedSplits.find(s => s.method === 'account' && s.amount > 0)
        if (accountSplit && customerId) {
          const { error: accountError } = await (supabase as any).rpc('charge_customer_account', {
            p_business_id: profile!.business_id,
            p_customer_id: customerId,
            p_amount: accountSplit.amount,
            p_sale_id: sale.id,
            p_user_id: profile!.id,
          })
          if (accountError) throw accountError
        }
      }

      setLastSaleId(sale.id)
      recordLoyaltyAfterSale(finalCustomerId, sale.id, total, loyaltyRedemption)

      // Si la venta vino de un presupuesto, dejarlo enlazado y cerrado.
      if (sourceQuoteId) {
        await quotesDb
          .from('quotes')
          .update({ sale_id: (sale as any).id, status: 'accepted' })
          .eq('id', sourceQuoteId)
      }

      let invoiceCae: string | null = null
      let invoiceCaeExpiry: string | null = null
      let invoiceNumber: number | undefined
      let puntoVenta: number | undefined
      let netoGravado: number | undefined
      let ivaAmount: number | undefined

      const business = useBusinessStore.getState().business
      if (business) {
        const pv = business.punto_venta || 1

        try {
          const caeResult = await requestCAE({
            invoiceType: receiptType,
            puntoVenta: pv,
            docTipo: docTipoNum,
            docNro: docNro,
            total,
            items: [...saleLines],
            discount,
            surcharge: surchargePct,
            businessIvaCondition: business.iva_condition || 'monotributo',
            env: fiscalEnv,
            saleId: (sale as any).id,
            businessId: profile!.business_id,
            customerName: resolvedCustomerName,
            customerIvaCondition: customerIvaCondition || (selectedCustomer ? (selectedCustomer as any).iva_condition : 'consumidor_final'),
          })

          if (caeResult.success && caeResult.cae) {
            setLastSaleHadCae(true)
            invoiceCae = caeResult.cae || null
            invoiceCaeExpiry = caeResult.caeExpiry || null
            invoiceNumber = caeResult.cbteNro
            puntoVenta = pv
            netoGravado = caeResult.netoGravado
            ivaAmount = caeResult.ivaAmount

            // requestCAE ya guardo el comprobante y sus items; aca actualizamos
            // el domicilio del cliente si lo tiene cargado.
            const invoiceId = caeResult.invoiceId
            if (invoiceId && selectedCustomer && (selectedCustomer as any).address) {
              await supabase.from('invoices')
                .update({ customer_address: (selectedCustomer as any).address })
                .eq('id', invoiceId)
            }
            toast.success(`Factura ${receiptType} autorizada — CAE: ${caeResult.cae}`)
          } else {
            setLastSaleHadCae(false)
            toast.warning('Venta registrada pero sin CAE: ' + (caeResult.error || 'Error AFIP'), { duration: 7000 })
          }
        } catch (err) {
          setLastSaleHadCae(false)
          console.error('AFIP error:', err)
          toast.warning('Venta registrada. Error al solicitar CAE.', { duration: 6000 })
        }
      } else {
        setLastSaleHadCae(false)
      }

      const subtotalRaw = getSubtotal()
      const afterDiscount = subtotalRaw - (subtotalRaw * discount) / 100
      const surchargeAmt = (afterDiscount * surchargePct) / 100
      setPostSaleData({
        businessName: business?.name || 'Mi Negocio',
        businessAddress: business?.address,
        businessPhone: business?.phone,
        businessEmail: business?.email,
        businessCuit: business?.cuit,
        ivaCondition: business?.iva_condition,
        iibb: business?.iibb,
        razonSocial: business?.razon_social,
        domicilioComercial: business?.domicilio_comercial,
        inicioActividades: business?.inicio_actividades,
        receiptType,
        items: [...saleLines],
        subtotal: subtotalRaw,
        discount,
        surcharge: surchargeAmt,
        surchargeAmount: surchargeAmt,
        total,
        paymentMethod: mixedPaymentMode ? 'mixed' : paymentMethod,
        installments,
        customerName: resolvedCustomerName,
        customerDocTipo: docTipoNum,
        customerDocNro: docNro !== '0' ? docNro : undefined,
        customerIvaCondition: customerIvaCondition || (selectedCustomer ? (selectedCustomer as any).iva_condition : undefined),
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

      clearCart()
      setDocNroCustomer('')
      setCustomerNameInput('')
      setDocTipoCustomer('99')
      setCustomerIvaCondition('consumidor_final')
      setSaveCustomerCheck(false)
      setAccountNote('')
      setShowConfirmModal(false)
      setShowSuccess(true)
      setShowTicketModal(true)
      setMixedPaymentMode(false); setMixedSplits([{ method: 'cash', amount: 0 }, { method: 'debit', amount: 0 }])
      playBeep(); fetchProducts()
      setTimeout(() => setShowSuccess(false), 2500)
    } catch { toast.error('Error inesperado') } finally { setProcessing(false) }
  }

  // Subtotal ya con promociones; el descuento manual se aplica sobre él.
  const subtotalRaw = getSubtotal()
  const promoAndRewardDiscount = getPromoDiscount()
  const discountAmt = subtotalRaw * discount / 100
  const afterDiscount = subtotalRaw - discountAmt
  const surchargeAmt = (afterDiscount * surchargePct) / 100
  const totalDisplay = getTotal()
  const pmDiscounts = (business as any)?.payment_method_discounts as Record<string, number> | null
  const currentPmDiscount = pmDiscountPct
  const effectiveDiscountPct = discount + (paymentMethod !== 'account' ? currentPmDiscount : 0)

  // ──────────────────────────────────────────────── //
  //                   RENDER                          //
  // ──────────────────────────────────────────────── //

  return (
    <div className="flex flex-col h-full max-h-full bg-background text-foreground overflow-hidden">
      {/* Sale success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-[#0d1b2d] border border-white/10 rounded-2xl p-10 text-center animate-fade-in shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-primary" />
            </div>
            <p className="text-xl font-bold text-white">¡Venta registrada!</p>
            <p className="text-sm text-slate-400 mt-1">
              {receiptType !== 'ticket'
                ? (lastSaleHadCae
                    ? `Factura ${receiptType} autorizada por AFIP`
                    : `Guardada sin CAE AFIP (Comprobante no fiscal)`)
                : 'Ticket generado'}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ HEADER ═══════════ */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 sm:px-6 border-b border-white/10 bg-surface/80 backdrop-blur-3xl shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/menu')}
            className="flex items-center gap-2 group"
            title="Volver al menú"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:border-[#947FF8]/40 group-hover:bg-[#947FF8]/10 transition-all">
              <CajaGoIcon size="sm" />
            </div>
          </button>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-[inset_0_0_12px_rgba(0,240,255,0.2)] border border-primary/20">
              <ShoppingCart className="w-4 h-4 text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-white tracking-tight uppercase">Nueva venta</span>
              {business?.name && (
                <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold hidden sm:block">{business.name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <SubscriptionBadge />
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
            cajaOpen
              ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[inset_0_0_12px_rgba(34,197,94,0.15)]'
              : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[inset_0_0_12px_rgba(239,68,68,0.15)]'
          }`}>
            <div className={`w-2 h-2 rounded-full ${cajaOpen ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,1)]' : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,1)]'} animate-pulse`} />
            <span className="uppercase tracking-wider hidden sm:inline">{cajaOpen ? 'Caja abierta' : 'Caja cerrada'}</span>
          </div>
          {profile?.name && (
            <div className="hidden sm:flex items-center gap-2 text-white/60 text-xs font-medium bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <User className="w-3.5 h-3.5 text-white/40" />
              <span>{profile.name?.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </header>

      {/* ═══════════ MAIN WORKSPACE ═══════════ */}
      <div className="flex-1 flex min-h-0" style={{ height: 'calc(100dvh - 3.5rem)' }}>
        {/* ──────── LEFT PANEL ──────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 min-[1280px]:max-w-[calc(100vw-380px)]">
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
                className="w-11 h-11 rounded-xl border border-primary/30 bg-primary/10 md:border-white/8 md:bg-[#0d1b2d] flex items-center justify-center text-primary md:text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-90 shrink-0"
                title="Escanear producto con la cámara"
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
                (() => {
                  const scale = parseSistelBarcode(search.trim())
                  if (scale) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-md mx-auto select-none py-10">
                        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4 text-sky-400">
                          <Scale className="w-8 h-8" />
                        </div>
                        <p className="text-base font-bold text-foreground">
                          Código de Balanza Sistel detectado
                        </p>
                        <div className="my-3 p-3.5 rounded-xl bg-surface border border-border text-xs text-left w-full space-y-1.5 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">PLU / Código detectado:</span>
                            <span className="font-mono font-bold text-foreground text-sm">{scale.plu}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Peso en balanza:</span>
                            <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400 text-sm">{scale.weightKg} kg</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border">
                            <span>Código de barras:</span>
                            <span className="font-mono">{scale.raw}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                          No existe ningún producto con el código <strong className="text-foreground font-mono">{scale.plu}</strong>. Crealo con unidad en kilogramos (kg) para pesarlo automáticamente al escanear.
                        </p>
                        <button
                          onClick={() => navigate(`/products?nuevo=${encodeURIComponent(scale.plu)}&unit=kg`)}
                          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                        >
                          Crear producto con PLU {scale.plu} (kg)
                        </button>
                      </div>
                    )
                  }
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 select-none">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                        <Search className="w-7 h-7 opacity-40" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">No se encontraron productos</p>
                      <p className="text-xs text-slate-600 mt-1">Probá con otro término de búsqueda</p>
                    </div>
                  )
                })()
              ) : (
                <div className="p-3">
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                    {visibleProducts.map((product, idx) => (
                      <button
                        key={product.id}
                        onClick={() => { handleProductClick(product); setSearch('') }}
                        disabled={product.stock <= 0}
                        style={{ animationDelay: `${idx * 12}ms` }}
                        className={`group relative flex flex-col rounded-xl p-3.5 text-left transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed min-h-[112px] bg-[#122238] border ${
                          product.stock === 0
                            ? 'border-red-500/10 opacity-40'
                            : product.stock <= (product.stock_min || 0)
                            ? 'border-amber-500/15 hover:border-amber-500/30 hover:bg-[#1a2d3d]'
                            : 'border-white/8 hover:border-primary/20 hover:bg-[#1a2d3d]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 relative z-[1]">
                          <h3 className="text-[13px] font-semibold text-white leading-snug whitespace-normal flex-1 text-left break-words">
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
                          className={`group relative flex flex-col rounded-xl p-3.5 text-left transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed min-h-[112px] bg-[#122238] border ${
                            product.stock === 0
                              ? 'border-red-500/10 opacity-40'
                              : product.stock <= (product.stock_min || 0)
                              ? 'border-amber-500/15 hover:border-amber-500/30 hover:bg-[#1a2d3d]'
                              : 'border-white/8 hover:border-primary/20 hover:bg-[#1a2d3d]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 relative z-[1]">
                            <h3 className="text-[13px] font-semibold text-white leading-snug whitespace-normal flex-1 text-left break-words">
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
        <div className="hidden min-[1280px]:flex w-[380px] shrink-0 border-l border-white/8 flex-col bg-[#0d1b2d] h-full overflow-hidden">
          {/* Checkout header */}
          <div className="shrink-0 px-4 pt-3.5 pb-2 border-b border-white/8">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-primary" />
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
                <div className="flex items-center gap-1.5">
                <button onClick={async () => { if (await requireManagerFor('Consumo de empleado')) setShowConsumption(true) }}
                  className="w-8 h-8 rounded-lg border border-white/8 bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                  title="Consumo de empleado (retirar sin vender)">
                  <Coffee className="w-3.5 h-3.5" />
                </button>
                <button onClick={async () => { if (await requireManagerFor('Vaciar la venta')) clearCart() }}
                  className="w-8 h-8 rounded-lg border border-white/8 bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                  title="Vaciar venta">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                </div>
              )}
            </div>

            {/* Customer selector */}
            {(() => {
              const displayName = customerNameInput.trim() || selectedCustomer?.name || 'Consumidor Final'
              const displayDoc = docNroCustomer.trim() || (selectedCustomer as any)?.doc_nro
              const hasCustomerData = !!selectedCustomer || !!customerNameInput.trim() || (!!docNroCustomer.trim() && docNroCustomer !== '0')

              return (
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className={`flex items-center gap-2.5 w-full p-2.5 rounded-xl border transition-all ${
                    hasCustomerData && displayName !== 'Consumidor Final'
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-white/8 bg-white/5 hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                    hasCustomerData && displayName !== 'Consumidor Final' ? 'bg-primary/15 text-primary border-primary/20' : 'bg-white/5 text-slate-500 border-white/8'
                  }`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cliente</p>
                    <p className="text-xs font-bold text-white truncate">
                      {displayName}
                    </p>
                    {displayDoc && displayDoc !== '0' && (
                      <p className="text-[9px] text-slate-400 truncate">
                        {DOC_TIPOS.find(d => String(d.id) === String(docTipoCustomer))?.code || 'Doc'}: {displayDoc}
                      </p>
                    )}
                  </div>
                  {hasCustomerData && (displayName !== 'Consumidor Final' || (displayDoc && displayDoc !== '0')) ? (
                    <span onClick={(e) => { e.stopPropagation(); handleSelectCustomer(null) }}
                      className="w-6 h-6 rounded-md hover:bg-white/8 flex items-center justify-center text-slate-500 hover:text-red-400 transition"
                      title="Quitar cliente">
                      <X className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </button>
              )
            })()}
          </div>

          {/* Scrollable middle section: cart items, loyalty & payment methods */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3 custom-scrollbar">
            {/* Cart items */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 select-none">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-3">
                  <ShoppingCart className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-0.5">Tu venta está vacía</p>
                <p className="text-xs text-slate-600 text-center max-w-[200px]">
                  Buscá o escaneá un producto para comenzar.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => {
                  const decimal = isDecimalUnit(item.product.unit)
                  const unit = UNIT_SHORT[item.product.unit as ProductUnit] || item.product.unit
                  const priced = promoByProduct.get(item.product.id)
                  const itemSubtotal = priced?.total ?? item.price * item.quantity
                  return (
                    <div key={item.product.id} className="group bg-[#122238] border border-white/8 rounded-xl p-3 transition-all hover:border-white/10">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-white leading-snug truncate">{item.product.name}</p>
                            <button onClick={async () => { if (await requireManagerFor('Quitar un producto')) removeItem(item.product.id) }}
                              className="w-5 h-5 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0 opacity-0 group-hover:opacity-100">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {formatCurrency(item.price)} <span className="text-slate-600">×</span> {item.quantity}{unit}{item.price < item.product.sale_price && <span className="ml-1.5 rounded bg-[#6178ee]/15 px-1 text-[10px] font-semibold text-[#9fb0ff]">Mayorista</span>}
                          </p>
                          {priced?.promotion && (
                            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <Tag className="w-3 h-3" /> {priced.promotion.name} · -{formatCurrency(priced.promotion.amount)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/8">
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/8">
                          <button onClick={() => changeQuantity(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/8 transition-colors active:scale-90">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input type="number" step={decimal ? "0.1" : "1"} min="0.1" value={item.quantity}
                            onChange={(e) => changeQuantity(item.product.id, parseFloat(e.target.value) || 0, true)}
                            className="w-12 h-6 text-center text-xs font-bold bg-transparent text-white focus:outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                          <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors active:scale-90">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-white tabular-nums text-right">
                          {priced?.promotion && (
                            <span className="block text-[10px] font-medium text-slate-500 line-through">{formatCurrency(item.price * item.quantity)}</span>
                          )}
                          {formatCurrency(itemSubtotal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {items.length > 0 && (
              <>
                {/* Loyalty Panel (now compact & collapsible) */}
                {renderLoyaltyPanel()}

                {/* Payment methods */}
                {!mixedPaymentMode && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Método de pago</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(qrReady && isOnline() ? [...POS_PAYMENT_OPTIONS, QR_PAYMENT_OPTION] : POS_PAYMENT_OPTIONS).map((opt) => {
                        const isSelected = opt.isCashDiscount
                          ? paymentMethod === 'cash' && pmDiscountPct > 0
                          : opt.isCashPlain
                            ? paymentMethod === 'cash' && pmDiscountPct === 0
                            : paymentMethod === opt.method
                        const pmPct = opt.isCashDiscount
                          ? (pmDiscounts?.cash ?? 10)
                          : opt.isCashPlain
                            ? 0
                            : (pmDiscounts?.[opt.method] ?? 0)

                        return (
                          <button key={opt.key} onClick={() => handleSelectPaymentOption(opt)}
                            className={`relative flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold border transition-all active:scale-[0.97] min-h-[50px] ${
                              isSelected
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                            }`}>
                            {isSelected && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />}
                            <opt.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                            <span className="leading-tight text-center px-1 truncate max-w-full">{opt.label}</span>
                            {pmPct > 0 && <span className="text-[8px] font-bold text-primary">-{pmPct}%</span>}
                          </button>
                        )
                      })}
                    </div>
                    {paymentMethod === 'account' && !customerId && (
                      <input
                        value={accountNote}
                        onChange={(e) => setAccountNote(e.target.value)}
                        placeholder="¿Quién se lo lleva / para qué obra? (opcional)"
                        className="mt-2 w-full h-9 px-3 rounded-xl border border-white/8 bg-white/5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/40"
                      />
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setMixedPaymentMode(!mixedPaymentMode)}
                    className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-[0.97] ${
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
                    className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-[0.97] ${
                      receiptType !== 'ticket'
                        ? 'border-primary/20 bg-primary/8 text-primary'
                        : 'border-white/8 bg-white/5 text-slate-500 hover:text-white hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {receiptType === 'ticket' ? 'Recibo' : `Factura ${receiptType}`}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </div>

                {/* Mixed splits */}
                {mixedPaymentMode && (
                  <div className="space-y-2 bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 animate-fade-in">
                    {mixedSplits.map((split, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={split.method} onChange={(e) => updateMixedSplit(i, 'method', e.target.value)}
                          className="h-8 px-2 rounded-lg border border-white/8 bg-[#0d1b2d] text-xs font-bold text-slate-400 focus:outline-none flex-1 min-w-0">
                          {PAYMENT_METHODS.map(pm => <option key={pm.id} value={pm.id} className="bg-[#07111f]">{pm.label}</option>)}
                        </select>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">$</span>
                          <input type="number" value={split.amount || ''} onChange={(e) => updateMixedSplit(i, 'amount', e.target.value)}
                            className="w-full h-8 pl-5 pr-2 rounded-lg border border-white/8 bg-[#0d1b2d] text-xs font-bold text-right text-white focus:outline-none" placeholder="0" />
                        </div>
                        {mixedSplits.length > 2 && (
                          <button onClick={() => removeMixedSplit(i)} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-red-400 transition">
                            <X className="w-3 h-3" />
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
              </>
            )}
          </div>

          {/* PINNED BOTTOM FOOTER: ALWAYS VISIBLE */}
          {items.length > 0 && (
            <div className="shrink-0 px-4 pt-2.5 pb-3 border-t border-white/8 bg-[#0d1b2d] space-y-2 shadow-2xl z-10">
              {/* Summary */}
              <div className="space-y-1 bg-[#122238] rounded-xl p-3 border border-white/8">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-semibold text-white">{formatCurrency(pricedCart.listSubtotal)}</span>
                </div>
                {promoAndRewardDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{loyaltyRedemption?.kind === 'product' ? 'Promociones y canje' : 'Promociones'}</span>
                    <span className="font-semibold text-emerald-400">-{formatCurrency(promoAndRewardDiscount)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Descuento ({discount}%)</span>
                    <span className="font-semibold text-amber-400">-{formatCurrency(discountAmt)}</span>
                  </div>
                )}
                {currentPmDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Desc. efectivo ({currentPmDiscount}%)</span>
                    <span className="font-semibold text-primary">-{formatCurrency(afterDiscount * currentPmDiscount / 100)}</span>
                  </div>
                )}
                {surchargePct > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Recargo ({surchargePct}%)</span>
                    <span className="font-semibold text-blue-400">+{formatCurrency(surchargeAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-white/8">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Total</span>
                  <span className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
                    {formatCurrency(totalDisplay)}
                  </span>
                </div>
              </div>

              {/* Cobrar button */}
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={items.length === 0}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm sm:text-base shadow-lg shadow-primary/20 disabled:bg-white/8 disabled:text-slate-600 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="truncate">Cobrar {formatCurrency(totalDisplay)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-white/90 font-bold shrink-0">F8</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ MOBILE ═══════════ */}
      {/* Bottom bar */}
      <div className="min-[1280px]:hidden shrink-0 border-t border-white/8 bg-[#0d1b2d] px-3 py-2.5 safe-bottom">
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
          <div className="min-[1280px]:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCart(false)} />
          <div
            className="min-[1280px]:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1b2d] border-t border-white/8 backdrop-blur-2xl rounded-t-2xl shadow-2xl animate-slide-in-up"
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
                    <button onClick={async () => { if (await requireManagerFor('Vaciar la venta')) clearCart() }} className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowCustomerModal(true)}
                  className="flex items-center gap-2 w-full p-2.5 rounded-xl border border-white/8 bg-white/5 hover:bg-white/5 transition-all text-left">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-white">{customerNameInput.trim() || selectedCustomer?.name || 'Consumidor Final'}</span>
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
                        {promoByProduct.get(item.product.id)?.promotion && (
                          <p className="text-[10px] font-bold text-emerald-400 mt-0.5">{promoByProduct.get(item.product.id)!.promotion!.name}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/8">
                          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                            <button onClick={() => changeQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <input type="number" step={decimal ? "0.1" : "1"} min="0.1" value={item.quantity}
                              onChange={(e) => changeQuantity(item.product.id, parseFloat(e.target.value) || 0, true)}
                              className="w-14 h-7 text-center text-xs font-bold bg-transparent text-white focus:outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-primary transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-white">
                            {formatCurrency(promoByProduct.get(item.product.id)?.total ?? item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {items.length > 0 && (
                <div className="shrink-0 px-4 pt-3 pb-4 space-y-3 border-t border-white/8">
                  {renderLoyaltyPanel()}
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

      {/* Escáner con cámara (códigos de barras, código propio y QR de producto) */}
      <CameraScanner open={showCameraScanner} onClose={stopCameraScanner} onScan={handleCameraScan} title="Escanear producto" hint="Seguí escaneando: cada lectura suma 1" />

      {/* Customer modal */}
      <Modal open={showCustomerModal} onClose={() => { setShowCustomerModal(false); setShowQuickCustomerForm(false) }} title="Seleccionar cliente" size="sm">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Buscar cliente por nombre o CUIT..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Quick toggle to type CUIT and Name */}
          {!showQuickCustomerForm ? (
            <button
              onClick={() => setShowQuickCustomerForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition"
            >
              <UserPlus className="w-4 h-4" /> + Crear nuevo cliente en agenda
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary" /> Datos del nuevo cliente
                </span>
                <button onClick={() => setShowQuickCustomerForm(false)} className="text-[11px] text-slate-400 hover:text-white">
                  Ocultar
                </button>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Nombre o Razón Social *</label>
                <input
                  type="text"
                  placeholder="Ej: Caloclor / Juan Pérez / Empresa SRL"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Tipo</label>
                  <select
                    value={docTipoCustomer}
                    onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-white/10 bg-[#0d1b2d] text-white text-xs focus:outline-none"
                  >
                    {DOC_TIPOS.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#07111f]">{d.code}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">CUIT / DNI (opcional)</label>
                  <input
                    type="text"
                    placeholder="20-12345678-9"
                    value={docNroCustomer}
                    onChange={(e) => handleDocNroChange(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Teléfono (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 11 1234-5678"
                  value={customerPhoneInput}
                  onChange={(e) => setCustomerPhoneInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={handleCreateAndSelectCustomer}
                  className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Guardar en agenda y seleccionar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId(null)
                    usePOSStore.getState().setWholesaleCustomer(false)
                    setShowQuickCustomerForm(false)
                    setShowCustomerModal(false)
                    toast.success('Datos aplicados solo a esta venta')
                  }}
                  className="w-full h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] font-medium transition"
                >
                  Solo aplicar a esta venta (sin guardar en agenda)
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 max-h-56 overflow-auto">
            <button
              onClick={() => { handleSelectCustomer(null); setShowCustomerModal(false) }}
              className={`w-full text-left p-3 rounded-xl border transition ${
                !customerId && !customerNameInput.trim() && !docNroCustomer.trim()
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-white/8 bg-white/5 hover:bg-white/8'
              } text-sm font-medium text-white`}
            >
              Consumidor Final (sin identificar)
            </button>
            {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c as any).doc_nro?.includes(customerSearch)).map(c => (
              <button
                key={c.id}
                onClick={() => { handleSelectCustomer(c); setShowCustomerModal(false) }}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  customerId === c.id ? 'border-primary/40 bg-primary/10' : 'border-white/8 bg-white/5 hover:bg-white/5'
                }`}
              >
                <p className="text-sm font-semibold text-white">{c.name}</p>
                {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                {(c as any).doc_nro && (
                  <p className="text-[11px] text-slate-400">
                    {DOC_TIPOS.find(d => String(d.id) === (c as any).doc_tipo)?.code || 'Doc'}: {(c as any).doc_nro}
                  </p>
                )}
                {c.balance > 0 && <Badge variant="warning" className="mt-1">Deuda: {formatCurrency(c.balance)}</Badge>}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Receipt type modal */}
      <Modal open={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Tipo de comprobante" size="sm">
        <div className="space-y-2">
          {RECEIPT_TYPES.map((rt) => {
            const isFiscal = rt.id !== 'ticket'
            const isDisabled = isFiscal && !isFiscalConnected
            return (
              <button key={rt.id} onClick={() => {
                if (!isDisabled) {
                  setReceiptType(rt.id);
                  if (rt.id === 'A' && docTipoCustomer === '99') {
                    setDocTipoCustomer('80');
                  }
                  setShowReceiptModal(false)
                }
              }} disabled={isDisabled}
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
                    {rt.id === 'ticket' ? <FileText className="w-4 h-4" /> : rt.id}
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
            <div className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/15 rounded-xl p-2.5 mt-2 space-y-1.5">
              <p className="text-center">
                {fiscalCertStatus
                  ? `La conexión con AFIP figura como "${CERT_STATUS_LABELS[fiscalCertStatus] || fiscalCertStatus}". Hay que terminar de configurarla para facturar.`
                  : 'No encontramos la configuración de AFIP de este negocio.'}
              </p>
              <button
                onClick={() => { setShowReceiptModal(false); navigate('/settings?tab=afip') }}
                className="w-full h-8 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold transition"
              >
                Ir a Facturación AFIP
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm modal */}
      <QrPaymentModal
        open={showQrModal}
        amount={getTotal()}
        reference={qrSaleIdRef.current ?? ''}
        description={`Compra en ${business?.name ?? 'CajaGo'}`}
        onPaid={onQrPaid}
        onClose={() => { setShowQrModal(false); qrSaleIdRef.current = null }}
      />
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
                <span className="font-semibold text-white">
                  {customerNameInput.trim() || selectedCustomer?.name || (docNroCustomer.trim() ? (docTipoCustomer === '80' ? `CUIT ${docNroCustomer}` : `Doc ${docNroCustomer}`) : 'Consumidor Final')}
                </span>
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
                <span className="font-semibold text-white">{receiptType === 'ticket' ? 'Recibo (no fiscal)' : `Factura ${receiptType}`}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-amber-400/80">
                  <span>Descuento {discount}%</span>
                  <span className="font-semibold">-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              {pmDiscountPct > 0 && (
                <div className="flex justify-between items-center text-primary">
                  <span>Desc. efectivo ({pmDiscountPct}%)</span>
                  <span className="font-semibold">-{formatCurrency(afterDiscount * pmDiscountPct / 100)}</span>
                </div>
              )}
              {surchargePct > 0 && (
                <div className="flex justify-between items-center text-blue-400/80">
                  <span>Recargo {surchargePct}%</span>
                  <span className="font-semibold">+{formatCurrency(surchargeAmt)}</span>
                </div>
              )}
              {receiptType === 'A' && (() => {
                const iva = calculateIVA('A', getSaleLines(), discount, surchargePct)
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

          {renderLoyaltyPanel()}

          {(receiptType !== 'ticket' || customerNameInput.trim() || docNroCustomer.trim() || selectedCustomer) && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Datos del cliente {receiptType !== 'ticket' ? `(Factura ${receiptType})` : ''}
                </span>
                {selectedCustomer && (
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-md font-medium">
                    Cliente seleccionado
                  </span>
                )}
              </div>

              {/* Nombre o Razón Social */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                  Nombre o Razón Social {receiptType === 'A' ? '*' : '(opcional)'}
                </label>
                <input
                  type="text"
                  placeholder={receiptType === 'A' ? 'Ej: Distribuidora Norte SA' : 'Consumidor Final (o nombre del cliente)'}
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </div>

              {/* Documento: Tipo y Número */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Tipo doc.</label>
                  <select
                    value={docTipoCustomer}
                    onChange={(e) => setDocTipoCustomer(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  >
                    {DOC_TIPOS.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#07111f]">{d.code}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                    {docTipoCustomer === '80' ? 'CUIT' : docTipoCustomer === '96' ? 'DNI' : 'Nro. de documento'} {receiptType === 'A' ? '*' : '(opcional)'}
                  </label>
                  <input
                    type="text"
                    placeholder={docTipoCustomer === '80' ? '20-12345678-9' : 'DNI / CUIT'}
                    value={docNroCustomer}
                    onChange={(e) => handleDocNroChange(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              {/* Condición de IVA (si ingresaron CUIT o es Factura A) */}
              {(docTipoCustomer === '80' || receiptType === 'A' || docNroCustomer.replace(/[^0-9]/g, '').length >= 10) && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">Condición IVA</label>
                  <select
                    value={customerIvaCondition}
                    onChange={(e) => setCustomerIvaCondition(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-white/10 bg-[#0d1b2d] text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  >
                    {IVA_CONDITIONS.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#07111f]">{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Opción para guardar cliente en base de datos si no existe */}
              {!customerId && (customerNameInput.trim() || docNroCustomer.trim()) && (
                <label className="flex items-center gap-2 pt-0.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveCustomerCheck}
                    onChange={(e) => setSaveCustomerCheck(e.target.checked)}
                    className="rounded border-white/20 bg-[#0d1b2d] text-primary focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Guardar en clientes para futuras ventas</span>
                </label>
              )}

              {receiptType === 'B' && !docNroCustomer.trim() && (
                <p className="text-[10px] text-slate-500">Para montos mayores a $22.850 AFIP puede requerir identificación</p>
              )}
              {receiptType === 'C' && !docNroCustomer.trim() && (
                <p className="text-[10px] text-slate-500">Opcional: Si el cliente no pide CUIT, se emite como Consumidor Final.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowConfirmModal(false)}
              className="flex-1 h-12 rounded-xl border border-white/8 bg-white/5 text-slate-400 hover:text-white hover:bg-white/8 font-bold text-sm transition-all active:scale-[0.98]">
              Cancelar (Esc)
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
                <><CheckCircle2 className="w-4 h-4" /> Confirmar (Enter / F8)</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {showConsumption && (
        <EmployeeConsumptionModal
          open
          onClose={() => setShowConsumption(false)}
          items={items}
          businessId={profile!.business_id}
          defaultName={profile?.name ?? ''}
          onDone={() => { clearCart(); fetchProducts() }}
        />
      )}

      <PostSaleModal
        open={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        data={postSaleData}
      />
    </div>
  )
}

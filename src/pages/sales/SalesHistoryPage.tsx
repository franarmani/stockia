import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalCustomers, getLocalProducts } from '@/sync/storage'
import { isOnline } from '@/sync/connectivity'
import { cachedQuery, todayKey } from '@/sync/remote'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeleton'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { toast } from 'sonner'
import { useManagerApproval } from '@/features/roles/managerApproval'
import type { Sale, SaleItem, Product, Customer } from '@/types/database'
import { useBusinessStore } from '@/stores/businessStore'
import InvoicePreviewModal from '@/components/pdf/InvoicePreviewModal'
import { downloadInvoicePDF } from '@/lib/pdfDownloader'
import type { InvoicePDFData } from '@/lib/invoicePdf'
import {
  Search, Receipt, CreditCard, Banknote,
  ArrowRightLeft, ChevronRight, ShoppingBag,
  CircleDollarSign, Ban, Filter, Eye, Download, Loader2,
} from 'lucide-react'

type SaleWithItems = Sale & {
  sale_items: (SaleItem & { product: Product })[]
  customer: Customer | null
  seller: { name: string } | null
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', debit: 'Débito', credit: 'Crédito',
  transfer: 'Transfer.', account: 'Cta. Cte.', card: 'Tarjeta',
}
const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote, debit: CreditCard, credit: CreditCard,
  transfer: ArrowRightLeft, account: CircleDollarSign, card: CreditCard,
}

const PAGE_SIZE = 30

export default function SalesHistoryPage() {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [sellerFilter, setSellerFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [page, setPage] = useState(1)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewPdfData, setPreviewPdfData] = useState<InvoicePDFData | null>(null)
  const [downloadingSale, setDownloadingSale] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [period, sellerFilter, paymentFilter])

  useEffect(() => {
    if (profile?.business_id) {
      fetchSales()
      fetchSellers()
    }
  }, [profile?.business_id, period, sellerFilter, paymentFilter, page])

  useEffect(() => {
    if (profile?.business_id) fetchSalesTotal()
  }, [profile?.business_id, period, sellerFilter, paymentFilter])

  useEffect(() => {
    if (!profile?.business_id) return
    return syncEngine.onSynced(() => { fetchSales(); fetchSalesTotal() })
  }, [profile?.business_id, period, sellerFilter, paymentFilter, page])

  const filterKey = () => `${profile!.business_id}:${period}:${sellerFilter}:${paymentFilter}:${todayKey()}`

  // Ventas hechas en este equipo que todavía no llegaron al servidor, con los mismos filtros.
  async function pendingSalesForFilters() {
    const start = periodStart()
    return (await syncEngine.getPendingSales(profile!.business_id)).filter(p =>
      (!start || p.sale.created_at >= start) &&
      (!sellerFilter || p.sale.seller_id === sellerFilter) &&
      (!paymentFilter || p.sale.payment_method === paymentFilter))
  }

  function periodStart(): string | null {
    const now = new Date()
    if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString()
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return null
  }

  async function fetchSellers() {
    const { data } = await cachedQuery(`sellers:${profile!.business_id}`, supabase.from('users').select('id, name').eq('business_id', profile!.business_id))
    setSellers((data as any[]) || [])
  }

  async function fetchSales() {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, sale_items(*, product:products(*)), customer:customers(*), seller:users!sales_seller_id_fkey(name)')
      .eq('business_id', profile!.business_id)
      .order('created_at', { ascending: false })

    const start = periodStart()
    if (start) query = query.gte('created_at', start)
    if (sellerFilter) query = query.eq('seller_id', sellerFilter)
    if (paymentFilter) query = query.eq('payment_method', paymentFilter)

    const from = (page - 1) * PAGE_SIZE
    const [{ data }, pending, products, customers] = await Promise.all([
      cachedQuery(`sales_history:${filterKey()}:${page}`, query.range(from, from + PAGE_SIZE - 1)),
      page === 1 ? pendingSalesForFilters() : Promise.resolve([]),
      getLocalProducts(profile!.business_id),
      getLocalCustomers(profile!.business_id),
    ])
    const pendingRows = pending.map(p => ({
      ...p.sale,
      voided: false,
      pending_sync: true,
      note: [p.sale.note, 'Pendiente de sincronizar'].filter(Boolean).join(' · '),
      customer: customers.find(c => c.id === p.sale.customer_id) ?? p.customerToCreate ?? null,
      seller: { name: profile!.name },
      sale_items: p.items.map(item => ({ ...item, product: products.find(product => product.id === item.product_id) ?? null })),
    })) as unknown as SaleWithItems[]
    setSales([...pendingRows, ...((data as unknown as SaleWithItems[]) || [])])
    setLoading(false)
  }

  // Total real del período, sin paginar (para el monto y el conteo totales)
  async function fetchSalesTotal() {
    let query = supabase
      .from('sales')
      .select('total, voided')
      .eq('business_id', profile!.business_id)

    const start = periodStart()
    if (start) query = query.gte('created_at', start)
    if (sellerFilter) query = query.eq('seller_id', sellerFilter)
    if (paymentFilter) query = query.eq('payment_method', paymentFilter)

    const [{ data }, pending] = await Promise.all([
      cachedQuery(`sales_total:${filterKey()}`, query),
      pendingSalesForFilters(),
    ])
    const rows = [...((data as any[]) || []), ...pending.map(p => ({ total: p.sale.total, voided: false }))]
    setTotalCount(rows.length)
    setTotalAmount(rows.filter((s) => !s.voided).reduce((sum, s) => sum + s.total, 0))
  }

  const filtered = sales.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.customer?.name?.toLowerCase().includes(q) ||
      s.note?.toLowerCase().includes(q) ||
      s.sale_items?.some((i: SaleWithItems['sale_items'][number]) => i.product?.name?.toLowerCase().includes(q))
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const periodTabs = [
    { id: 'today' as const, label: 'Hoy' },
    { id: 'week' as const, label: '7 días' },
    { id: 'month' as const, label: 'Mes' },
    { id: 'all' as const, label: 'Todo' },
  ]

  async function handleVoidSale() {
    if (!selectedSale || voiding) return
    if ((selectedSale as any).pending_sync) {
      toast.error('Esta venta todavía no se sincronizó. Podés anularla cuando vuelva la conexión.')
      return
    }
    if (!isOnline()) {
      toast.error('Anular una venta requiere conexión con el servidor.')
      return
    }
    if (!confirm('¿Estás seguro de anular esta venta? Se repondrá el stock.')) return
    // Quien no es administrador necesita el código de un encargado (se verifica en el servidor).
    let pin: string | null = null
    if (profile?.role !== 'admin') {
      pin = await useManagerApproval.getState().request('Anular la venta')
      if (!pin) return
    }
    setVoiding(true)
    try {
      const { data: result, error } = await (supabase as any).rpc('void_sale', { p_sale_id: selectedSale.id, p_pin: pin })
      if (error) throw error
      if (result === 'bad_pin') { toast.error('Código de encargado incorrecto'); return }
      toast.success('Venta anulada correctamente')
      setSelectedSale(null)
      fetchSales()
    } catch (error: any) {
      toast.error(error?.message ? `No se pudo anular: ${error.message}` : 'Error al anular la venta')
    } finally {
      setVoiding(false)
    }
  }

  function buildPDFDataFromSale(sale: SaleWithItems): InvoicePDFData | null {
    if (!business) return null
    const cartItems = (sale.sale_items || []).map((i) => ({
      product: i.product,
      quantity: i.quantity,
      price: i.price,
    }))
    return {
      businessName: business.name,
      businessCuit: business.cuit,
      businessAddress: business.address,
      businessPhone: business.phone,
      businessEmail: business.email,
      ivaCondition: business.iva_condition,
      iibb: (business as any).iibb,
      razonSocial: (business as any).razon_social,
      domicilioComercial: (business as any).domicilio_comercial,
      inicioActividades: (business as any).inicio_actividades,
      invoiceType: sale.receipt_type || 'ticket',
      invoiceNumber: (sale as any).invoice_number || 0,
      puntoVenta: (sale as any).punto_venta || 1,
      cae: (sale as any).cae || null,
      caeExpiry: (sale as any).cae_expiry || null,
      date: new Date(sale.created_at),
      customerName: sale.customer?.name || 'Consumidor Final',
      items: cartItems,
      subtotal: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) || sale.total,
      discount: sale.discount || 0,
      surchargeAmount: 0,
      total: sale.total,
      paymentMethod: sale.payment_method || 'cash',
      installments: sale.installments,
      receiptFooter: business.receipt_footer,
      logoUrl: business.logo_url,
      primaryColor: (business as any).primary_color,
    }
  }

  function handleOpenSalePreview(sale: SaleWithItems) {
    const data = buildPDFDataFromSale(sale)
    if (!data) {
      toast.error('No se pudo generar la vista previa')
      return
    }
    setPreviewPdfData(data)
    setShowPreviewModal(true)
  }

  async function handleDownloadSalePDF(sale: SaleWithItems) {
    const data = buildPDFDataFromSale(sale)
    if (!data) return
    setDownloadingSale(true)
    const toastId = toast.loading('Generando PDF...')
    try {
      await downloadInvoicePDF(data, { mode: 'color' })
      toast.success('¡PDF descargado con éxito!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Error al generar el PDF', { id: toastId })
    } finally {
      setDownloadingSale(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Historial de ventas</h1>
          <p className="text-xs text-white/50 mt-1 font-medium">
            {totalCount} ventas — Total acumulado: <span className="text-emerald-400 font-mono font-bold">{formatCurrency(totalAmount)}</span>
          </p>
        </div>
      </div>

      {/* Period tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-[#0B1120] border border-white/[0.08] rounded-xl p-1 gap-1 shrink-0 shadow-sm">
          {periodTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === t.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por cliente o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3.5 rounded-xl border border-white/[0.08] bg-[#0B1120] text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-white/50 font-medium">
          <Filter className="w-3.5 h-3.5 text-blue-400" /> Filtros:
        </div>
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="h-8 px-2.5 rounded-xl border border-white/[0.08] bg-[#0B1120] text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 shadow-sm"
        >
          <option value="" className="bg-[#0B1120] text-white">Todos los vendedores</option>
          {sellers.map(s => <option key={s.id} value={s.id} className="bg-[#0B1120] text-white">{s.name}</option>)}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="h-8 px-2.5 rounded-xl border border-white/[0.08] bg-[#0B1120] text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 shadow-sm"
        >
          <option value="" className="bg-[#0B1120] text-white">Todos los pagos</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#0B1120] text-white">{v}</option>)}
        </select>
        {(sellerFilter || paymentFilter) && (
          <button
            onClick={() => { setSellerFilter(''); setPaymentFilter('') }}
            className="h-8 px-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Sales list */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-[#0B1120] border border-white/[0.08] rounded-2xl shadow-xl text-center py-16 text-white/40">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20 text-blue-400" />
          <p className="text-sm font-semibold text-white/60">Sin ventas en este período</p>
          <p className="text-xs text-white/30 mt-1">Prueba cambiando el rango de fechas o los filtros</p>
        </div>
      ) : (
        <div className="bg-[#0B1120] border border-white/[0.08] rounded-2xl shadow-xl divide-y divide-white/[0.06] overflow-hidden">
          {filtered.map((sale) => {
            const Icon = PAYMENT_ICONS[sale.payment_method] || ArrowRightLeft
            return (
              <button
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/[0.04] transition-colors text-left group ${sale.voided ? 'opacity-40' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  sale.voided
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform'
                }`}>
                  {sale.voided ? <Ban className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                      {sale.sale_items?.map((i: SaleWithItems['sale_items'][number]) => i.product?.name).filter(Boolean).join(', ') || 'Venta'}
                    </p>
                    {sale.voided && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Anulada
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 text-xs text-white/40">
                    <span className="text-white/60 font-medium">
                      {new Date(sale.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      {' '}
                      {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {sale.customer && <span>• <strong className="text-white/70 font-medium">{sale.customer.name}</strong></span>}
                    {sale.note && <span>• {sale.note}</span>}
                    {sale.seller && <span>• {sale.seller.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm sm:text-base font-extrabold font-mono tabular-nums ${
                      sale.voided ? 'text-rose-400 line-through' : 'text-white'
                    }`}>
                      {formatCurrency(sale.total)}
                    </p>
                    <div className="flex items-center gap-1 text-white/50 justify-end text-xs mt-0.5 font-medium">
                      <Icon className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px]">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm pt-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-white/50 font-medium">Página {page} de {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selectedSale} onClose={() => setSelectedSale(null)} title="Detalle de venta" size="md">
        {selectedSale && (
          <div className="space-y-4">
            {selectedSale.voided && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs sm:text-sm text-rose-200 font-semibold text-center">
                Venta anulada {selectedSale.voided_at && `el ${new Date(selectedSale.voided_at).toLocaleDateString('es-AR')}`}
              </div>
            )}

            <div className="flex items-center justify-between text-xs sm:text-sm text-white/60">
              <span>
                {new Date(selectedSale.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}
                {new Date(selectedSale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold">
                {PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}
              </span>
            </div>

            {selectedSale.customer && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-xs sm:text-sm text-white/80">
                <span className="text-white/40">Cliente:</span>{' '}
                <span className="font-bold text-white">{selectedSale.customer.name}</span>
              </div>
            )}

            {selectedSale.note && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-xs sm:text-sm text-white/80">
                <span className="text-white/40">Nota:</span>{' '}
                <span className="font-medium text-white">{selectedSale.note}</span>
              </div>
            )}

            {selectedSale.seller && (
              <div className="text-xs text-white/50">
                Vendedor: <span className="font-semibold text-white">{selectedSale.seller.name}</span>
              </div>
            )}

            {selectedSale.receipt_type && selectedSale.receipt_type !== 'ticket' && (
              <div className="text-xs text-white/50">
                Comprobante: <span className="font-semibold text-white">Factura {selectedSale.receipt_type}</span>
              </div>
            )}

            <div className="space-y-2 border-t border-b border-white/[0.08] py-3">
              {selectedSale.sale_items?.map((item: SaleWithItems['sale_items'][number]) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 text-xs sm:text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{item.product?.name || 'Producto'}</p>
                    <p className="text-white/40 text-[11px]">{item.quantity} x {formatCurrency(item.price)}</p>
                  </div>
                  <span className="font-bold font-mono tabular-nums text-white shrink-0">{formatCurrency(item.quantity * item.price)}</span>
                </div>
              ))}
            </div>

            {selectedSale.discount > 0 && (
              <div className="flex items-center justify-between text-xs sm:text-sm text-amber-400">
                <span>Descuento ({selectedSale.discount}%)</span>
                <span className="font-mono font-bold">-{formatCurrency(selectedSale.total * selectedSale.discount / (100 - selectedSale.discount))}</span>
              </div>
            )}

            {selectedSale.surcharge_pct > 0 && (
              <div className="flex items-center justify-between text-xs sm:text-sm text-blue-400">
                <span>Recargo ({selectedSale.surcharge_pct}%)</span>
                <span className="font-semibold">+recargo incluido</span>
              </div>
            )}

            {selectedSale.installments > 1 && (
              <div className="flex items-center justify-between text-xs sm:text-sm text-white/50">
                <span>Cuotas</span>
                <span className="font-mono font-semibold">{selectedSale.installments}x {formatCurrency(selectedSale.total / selectedSale.installments)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold text-white">Total</span>
              <span className={`text-xl font-extrabold font-mono tabular-nums ${
                selectedSale.voided ? 'text-rose-400 line-through' : 'text-emerald-400'
              }`}>
                {formatCurrency(selectedSale.total)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => handleOpenSalePreview(selectedSale)}
              >
                <Eye className="w-4 h-4 text-blue-400" />
                <span>Vista Previa</span>
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-900/30"
                disabled={downloadingSale}
                onClick={() => handleDownloadSalePDF(selectedSale)}
              >
                {downloadingSale ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Descargar PDF</span>
              </Button>
            </div>

            {/* Void button */}
            {!selectedSale.voided && (
              <Button variant="destructive" className="w-full mt-1" onClick={handleVoidSale} disabled={voiding}>
                <Ban className="w-4 h-4" />
                {voiding ? 'Anulando...' : 'Anular venta'}
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Sale PDF Preview Modal */}
      <InvoicePreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        invoiceData={previewPdfData}
      />
    </div>
  )
}

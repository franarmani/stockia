import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { quotesDb } from '@/lib/quotesDb'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { usePOSStore } from '@/stores/posStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { openQuotePDF, getQuoteWhatsAppLink, type QuotePDFData } from '@/lib/quotePdf'
import type { PrintMode } from '@/lib/documentLayout'
import { IVA_CONDITIONS, QUOTE_STATUS_LABELS } from '@/types/database'
import type { Quote, QuoteItem, QuoteStatus, Customer, Product, CartItem } from '@/types/database'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import QuoteFormModal from './QuoteFormModal'
import {
  ClipboardList, Plus, Search, Printer, Palette, MessageCircle, Eye,
  CheckCircle2, XCircle, Trash2, ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS_STYLES: Record<QuoteStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  expired: 'bg-slate-500/15 text-slate-400',
}

function padNumber(n: number, len: number) {
  return String(n).padStart(len, '0')
}

/** Un presupuesto pendiente cuya validez ya pasó se muestra como vencido. */
function effectiveStatus(q: Quote): QuoteStatus {
  if (q.status === 'pending' && q.valid_until) {
    const today = new Date().toISOString().slice(0, 10)
    if (q.valid_until < today) return 'expired'
  }
  return q.status
}

export default function QuotesPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const loadCart = usePOSStore(s => s.loadCart)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>('all')

  const [showForm, setShowForm] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)

  const [detailQuote, setDetailQuote] = useState<Quote | null>(null)
  const [detailItems, setDetailItems] = useState<QuoteItem[]>([])

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (profile?.business_id) {
      fetchQuotes()
      fetchCustomers()
      fetchProducts()
    }
  }, [profile?.business_id])

  async function fetchQuotes() {
    setLoading(true)
    const { data } = await quotesDb
      .from('quotes')
      .select('*')
      .eq('business_id', profile!.business_id)
      .order('created_at', { ascending: false })
      .limit(500)
    setQuotes((data || []) as unknown as Quote[])
    setLoading(false)
  }

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', profile!.business_id)
      .order('name')
    setCustomers((data || []) as unknown as Customer[])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', profile!.business_id)
      .eq('active', true)
      .order('name')
    setProducts((data || []) as unknown as Product[])
  }

  async function loadItems(quoteId: string): Promise<QuoteItem[]> {
    const { data } = await quotesDb
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true })
    return (data || []) as unknown as QuoteItem[]
  }

  async function openDetail(q: Quote) {
    setDetailQuote(q)
    setDetailItems([])
    setDetailItems(await loadItems(q.id))
  }

  function buildPdfData(q: Quote, items: QuoteItem[]): QuotePDFData {
    const b = business as any
    return {
      businessName: business?.name || '',
      businessCuit: b?.cuit,
      businessAddress: b?.address,
      businessPhone: b?.phone,
      businessEmail: b?.email,
      razonSocial: b?.razon_social,
      domicilioComercial: b?.domicilio_comercial,
      ivaConditionLabel: IVA_CONDITIONS.find(c => c.id === b?.iva_condition)?.label,
      puntoVenta: b?.punto_venta,
      receiptFooter: b?.receipt_footer,
      quoteNumber: q.quote_number,
      date: new Date(q.created_at),
      validUntil: q.valid_until ? new Date(`${q.valid_until}T12:00:00`) : null,
      notes: q.notes,
      customerName: q.customer_name || 'Consumidor Final',
      customerPhone: q.customer_phone,
      items: items.map(i => ({
        description: i.description,
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      total: Number(q.total),
      logoUrl: business?.logo_url,
      primaryColor: b?.primary_color || undefined,
    }
  }

  async function handlePrint(q: Quote, mode: PrintMode = 'bw') {
    const items = await loadItems(q.id)
    if (items.length === 0) { toast.error('El presupuesto no tiene productos'); return }
    openQuotePDF(buildPdfData(q, items), mode)
  }

  async function handleWhatsApp(q: Quote) {
    const items = await loadItems(q.id)
    if (items.length === 0) { toast.error('El presupuesto no tiene productos'); return }
    window.open(getQuoteWhatsAppLink(buildPdfData(q, items), q.customer_phone), '_blank')
  }

  /**
   * Manda los productos del presupuesto al carrito del POS. No registra la
   * venta acá: el cobro tiene que pasar por el flujo normal, que es el que
   * descuenta stock, mueve caja y emite el comprobante fiscal.
   */
  async function handleConvertToSale(q: Quote) {
    const items = await loadItems(q.id)
    if (items.length === 0) { toast.error('El presupuesto no tiene productos'); return }

    // Los ítems guardan el precio congelado, pero el carrito necesita el
    // producto completo (stock, costo, unidad), así que hay que releerlos.
    const productIds = items.map(i => i.product_id).filter((id): id is string => !!id)
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000'])
    const byId = new Map((data || []).map((p: any) => [p.id, p as Product]))

    const cartItems: CartItem[] = []
    const missing: string[] = []
    for (const i of items) {
      const product = i.product_id ? byId.get(i.product_id) : undefined
      if (!product) { missing.push(i.description); continue }
      cartItems.push({ product, quantity: Number(i.quantity), price: Number(i.price) })
    }

    if (cartItems.length === 0) {
      toast.error('Ninguno de los productos sigue disponible. Cargá la venta manualmente.')
      return
    }
    if (missing.length > 0) {
      toast.warning(
        `${missing.length} ${missing.length === 1 ? 'ítem no se pudo cargar' : 'ítems no se pudieron cargar'} ` +
        `(sin producto asociado o dado de baja): ${missing.join(', ')}`
      )
    }

    // El descuento se conserva; el precio de cada línea es el presupuestado.
    loadCart(cartItems, {
      discount: Number(q.discount),
      customerId: q.customer_id,
      sourceQuoteId: q.id,
    })

    if (q.status !== 'accepted') await changeStatus(q, 'accepted')
    setDetailQuote(null)
    toast.success('Productos cargados en el punto de venta')
    navigate('/pos')
  }

  async function changeStatus(q: Quote, status: QuoteStatus) {
    const { error } = await quotesDb.from('quotes').update({ status }).eq('id', q.id)
    if (error) { toast.error('No se pudo actualizar el estado'); return }
    toast.success(`Presupuesto marcado como ${QUOTE_STATUS_LABELS[status].toLowerCase()}`)
    setDetailQuote(prev => prev && prev.id === q.id ? { ...prev, status } : prev)
    fetchQuotes()
  }

  async function handleDelete(q: Quote) {
    if (!confirm(`¿Eliminar el presupuesto Nº ${padNumber(q.quote_number, 8)}?\n\nEsta acción no se puede deshacer.`)) return
    const { error } = await quotesDb.from('quotes').delete().eq('id', q.id)
    if (error) { toast.error('No se pudo eliminar'); return }
    toast.success('Presupuesto eliminado')
    setDetailQuote(null)
    fetchQuotes()
  }

  function openNew() {
    setEditingQuote(null)
    setShowForm(true)
  }

  async function openEdit(q: Quote) {
    setEditingQuote(q)
    setShowForm(true)
  }

  const filtered = useMemo(() => quotes.filter((q) => {
    if (filterStatus !== 'all' && effectiveStatus(q) !== filterStatus) return false
    if (search) {
      const s = search.toLowerCase()
      const matchesNumber = padNumber(q.quote_number, 8).includes(s.replace(/\D/g, ''))
      const matchesName = (q.customer_name || '').toLowerCase().includes(s)
      if (!matchesNumber && !matchesName) return false
    }
    return true
  }), [quotes, filterStatus, search])

  const pendingTotal = useMemo(
    () => quotes.filter(q => effectiveStatus(q) === 'pending').reduce((s, q) => s + Number(q.total), 0),
    [quotes]
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            {quotes.length} en total
            {pendingTotal > 0 && <> · {formatCurrency(pendingTotal)} pendiente de respuesta</>}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> Nuevo presupuesto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por número o cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'accepted', 'rejected', 'expired'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 h-10 text-sm rounded-xl border transition ${
                filterStatus === s
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              {s === 'all' ? 'Todos' : QUOTE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="py-16 flex justify-center"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title={quotes.length === 0 ? 'Todavía no hay presupuestos' : 'Sin resultados'}
          description={
            quotes.length === 0
              ? 'Creá un presupuesto para enviarle a un cliente antes de concretar la venta.'
              : 'Probá con otro término de búsqueda o cambiá el filtro.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Validez</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => {
                const st = effectiveStatus(q)
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{padNumber(q.quote_number, 8)}</TableCell>
                    <TableCell>{q.customer_name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(q.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {q.valid_until ? formatDate(q.valid_until) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_STYLES[st]}`}>
                        {QUOTE_STATUS_LABELS[st]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(q.total))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Ver detalle" onClick={() => openDetail(q)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="PDF blanco y negro" onClick={() => handlePrint(q, 'bw')}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="PDF a color" onClick={() => handlePrint(q, 'color')}>
                          <Palette className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Enviar por WhatsApp" onClick={() => handleWhatsApp(q)}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        {st !== 'rejected' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Convertir en venta"
                            onClick={() => handleConvertToSale(q)}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Alta / edición */}
      <QuoteFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        quote={editingQuote}
        customers={customers}
        products={products}
        onSaved={() => { setShowForm(false); fetchQuotes() }}
        loadItems={loadItems}
      />

      {/* Detalle */}
      <Modal
        open={!!detailQuote}
        onClose={() => setDetailQuote(null)}
        title={detailQuote ? `Presupuesto Nº ${padNumber(detailQuote.quote_number, 8)}` : ''}
        size="lg"
      >
        {detailQuote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{detailQuote.customer_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_STYLES[effectiveStatus(detailQuote)]}`}>
                  {QUOTE_STATUS_LABELS[effectiveStatus(detailQuote)]}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p>{formatDate(detailQuote.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válido hasta</p>
                <p>{detailQuote.valid_until ? formatDate(detailQuote.valid_until) : '-'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 divide-y divide-white/5">
              {detailItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{i.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(i.quantity)} x {formatCurrency(Number(i.price))}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap ml-3">
                    {formatCurrency(Number(i.price) * Number(i.quantity))}
                  </p>
                </div>
              ))}
              {detailItems.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">Cargando productos…</p>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(Number(detailQuote.subtotal))}</span>
              </div>
              {Number(detailQuote.discount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento {Number(detailQuote.discount)}%</span>
                  <span>-{formatCurrency(Number(detailQuote.subtotal) * Number(detailQuote.discount) / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-white/10">
                <span>Total</span><span>{formatCurrency(Number(detailQuote.total))}</span>
              </div>
            </div>

            {detailQuote.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm whitespace-pre-wrap">{detailQuote.notes}</p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={() => handlePrint(detailQuote, 'bw')}>
                <Printer className="w-4 h-4" /> PDF B/N
              </Button>
              <Button variant="outline" onClick={() => handlePrint(detailQuote, 'color')}>
                <Palette className="w-4 h-4" /> PDF color
              </Button>
              <Button variant="outline" onClick={() => handleWhatsApp(detailQuote)}>
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
              {!detailQuote.sale_id && (
                <Button onClick={() => handleConvertToSale(detailQuote)}>
                  <ShoppingCart className="w-4 h-4" /> Convertir en venta
                </Button>
              )}
              {detailQuote.status === 'pending' && (
                <>
                  <Button variant="outline" onClick={() => changeStatus(detailQuote, 'accepted')}>
                    <CheckCircle2 className="w-4 h-4" /> Marcar aceptado
                  </Button>
                  <Button variant="outline" onClick={() => changeStatus(detailQuote, 'rejected')}>
                    <XCircle className="w-4 h-4" /> Rechazado
                  </Button>
                </>
              )}
              {detailQuote.status === 'pending' && (
                <Button variant="outline" onClick={() => { const q = detailQuote; setDetailQuote(null); openEdit(q) }}>
                  Editar
                </Button>
              )}
              <Button variant="destructive" onClick={() => handleDelete(detailQuote)}>
                <Trash2 className="w-4 h-4" /> Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

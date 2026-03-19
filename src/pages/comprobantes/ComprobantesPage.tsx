import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { requestCAE, getCbteTipo } from '@/lib/afipService'
import { openInvoicePDF, type InvoicePDFData } from '@/lib/invoicePdf'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import type { Invoice, CartItem, InvoiceItem, Product } from '@/types/database'
import { CBTE_TIPOS, IVA_CONDITIONS } from '@/types/database'
import {
  FileText, Search, Filter, Eye, Ban, ChevronDown, ChevronUp,
  Calendar, Download, RotateCcw, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

const CBTE_LABELS: Record<number, string> = {
  [CBTE_TIPOS.factura_a]: 'Factura A',
  [CBTE_TIPOS.factura_b]: 'Factura B',
  [CBTE_TIPOS.factura_c]: 'Factura C',
  [CBTE_TIPOS.nota_credito_a]: 'NC A',
  [CBTE_TIPOS.nota_credito_b]: 'NC B',
  [CBTE_TIPOS.nota_credito_c]: 'NC C',
  [CBTE_TIPOS.nota_debito_a]: 'ND A',
  [CBTE_TIPOS.nota_debito_b]: 'ND B',
  [CBTE_TIPOS.nota_debito_c]: 'ND C',
}

function getCbteColor(cbteTipo: number) {
  if ([1, 2, 3].includes(cbteTipo)) return 'bg-blue-100 text-blue-700'
  if ([6, 7, 8].includes(cbteTipo)) return 'bg-green-100 text-green-700'
  return 'bg-purple-100 text-purple-700'
}

function padNumber(n: number, len: number) {
  return String(n).padStart(len, '0')
}

function getIvaLabel(id: string | null | undefined) {
  return IVA_CONDITIONS.find(c => c.id === id)?.label || id || '-'
}

export default function ComprobantesPage() {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showNCModal, setShowNCModal] = useState(false)
  const [ncSourceInvoice, setNCSourceInvoice] = useState<Invoice | null>(null)
  const [ncProcessing, setNCProcessing] = useState(false)
  const [ncReason, setNCReason] = useState('')
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([])

  useEffect(() => {
    if (profile?.business_id) fetchInvoices()
  }, [profile?.business_id])

  async function fetchInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('business_id', profile!.business_id)
      .order('created_at', { ascending: false })
      .limit(500)
    setInvoices(data || [])
    setLoading(false)
  }

  async function openDetail(inv: Invoice) {
    setSelectedInvoice(inv)
    setDetailItems([])
    setShowDetailModal(true)
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('created_at', { ascending: true })
    setDetailItems(data || [])
  }

  async function handleVoid(inv: Invoice) {
    if (inv.voided) return
    if (!confirm(`¿Anular comprobante ${CBTE_LABELS[inv.cbte_tipo]} ${padNumber(inv.punto_venta, 5)}-${padNumber(inv.invoice_number, 8)}?\n\nPara anularlo fiscalmente ante AFIP, emití una Nota de Crédito.`)) return
    await supabase.from('invoices').update({ voided: true }).eq('id', inv.id)
    toast.success('Comprobante marcado como anulado')
    fetchInvoices()
  }

  function openNCModal(inv: Invoice) {
    if ([3, 8, 13].includes(inv.cbte_tipo)) {
      toast.error('No se puede emitir NC desde otra Nota de Crédito')
      return
    }
    if (inv.voided) {
      toast.error('El comprobante ya está anulado')
      return
    }
    setNCSourceInvoice(inv)
    setNCReason('')
    setShowNCModal(true)
  }

  async function handleEmitNC() {
    if (!ncSourceInvoice || !business || !profile) return
    setNCProcessing(true)

    try {
      const inv = ncSourceInvoice
      const ncCbteTipo = getCbteTipo(inv.invoice_type, true)
      const pv = inv.punto_venta

      const { data: ncInvoice, error: insertErr } = await supabase
        .from('invoices')
        .insert({
          sale_id: inv.sale_id,
          business_id: profile.business_id,
          invoice_type: inv.invoice_type,
          cbte_tipo: ncCbteTipo,
          punto_venta: pv,
          doc_tipo: inv.doc_tipo,
          doc_nro: inv.doc_nro,
          customer_name: inv.customer_name,
          iva_condition_customer: inv.iva_condition_customer,
          neto_gravado: inv.neto_gravado,
          neto_no_gravado: inv.neto_no_gravado,
          exento: inv.exento,
          iva_amount: inv.iva_amount,
          total: inv.total,
          credit_note_for: inv.id,
          status: 'draft',
        })
        .select()
        .single()

      if (insertErr || !ncInvoice) {
        toast.error('Error al crear la nota de crédito')
        setNCProcessing(false)
        return
      }

      try {
        const caeResult = await requestCAE({
          invoiceType: inv.invoice_type,
          puntoVenta: pv,
          docTipo: inv.doc_tipo,
          docNro: inv.doc_nro || '0',
          total: inv.total,
          items: [],
          discount: 0,
          surcharge: 0,
          businessIvaCondition: business.iva_condition || 'monotributo',
        })

        if (caeResult.success) {
          await supabase.from('invoices').update({
            cae: caeResult.cae,
            cae_expiry: caeResult.caeExpiry,
            invoice_number: caeResult.cbteNro || 0,
            status: 'authorized',
            afip_request: caeResult.request,
            afip_response: caeResult.response,
          }).eq('id', ncInvoice.id)

          await supabase.from('invoices').update({ voided: true }).eq('id', inv.id)
          toast.success(`Nota de Crédito ${inv.invoice_type} emitida — CAE: ${caeResult.cae}`)
        } else {
          await supabase.from('invoices').update({
            status: 'rejected',
            afip_response: caeResult.response || caeResult.error,
          }).eq('id', ncInvoice.id)
          toast.warning('NC creada pero sin CAE: ' + (caeResult.error || 'Error AFIP'))
        }
      } catch (err) {
        console.error('NC AFIP error:', err)
        toast.warning('NC registrada. Error al solicitar CAE a AFIP.')
      }

      setShowNCModal(false)
      fetchInvoices()
    } catch (err) {
      console.error('NC error:', err)
      toast.error('Error al emitir Nota de Crédito')
    }
    setNCProcessing(false)
  }

  async function handleDownloadPDF(inv: Invoice) {
    if (!business) return

    // Fetch invoice line items for the PDF
    const { data: lineItems } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('created_at', { ascending: true })

    const cartItems: CartItem[] = (lineItems || []).map((li) => ({
      product: {
        id: li.product_id || '',
        business_id: business.id,
        name: li.description,
        brand: null,
        sku: null,
        barcode: null,
        category_id: null,
        supplier_id: null,
        purchase_price: 0,
        sale_price: li.unit_price,
        avg_cost: 0,
        stock: 0,
        stock_min: 0,
        unit: 'un',
        active: true,
        description: null,
        image_url: null,
        size_label: null,
        model: null,
        presentation: null,
        created_at: li.created_at,
      } as unknown as Product,
      quantity: li.qty,
      price: li.unit_price,
    }))

    const pdfData: InvoicePDFData = {
      businessName: business.name,
      businessCuit: business.cuit,
      businessAddress: business.address,
      businessPhone: business.phone,
      ivaCondition: business.iva_condition,
      iibb: (business as any).iibb,
      razonSocial: (business as any).razon_social,
      domicilioComercial: (business as any).domicilio_comercial,
      inicioActividades: (business as any).inicio_actividades,
      invoiceType: inv.invoice_type,
      invoiceNumber: inv.invoice_number,
      puntoVenta: inv.punto_venta,
      cae: inv.cae,
      caeExpiry: inv.cae_expiry,
      date: new Date(inv.created_at),
      customerName: inv.customer_name || 'Consumidor Final',
      customerDocTipo: inv.doc_tipo,
      customerDocNro: inv.doc_nro || undefined,
      customerIvaCondition: inv.iva_condition_customer || undefined,
      items: cartItems,
      subtotal: inv.total,
      discount: 0,
      surchargeAmount: 0,
      total: inv.total,
      netoGravado: inv.neto_gravado,
      ivaAmount: inv.iva_amount,
      netoNoGravado: inv.neto_no_gravado,
      exento: inv.exento,
      paymentMethod: '-',
    }
    openInvoicePDF(pdfData)
  }

  const filtered = invoices.filter((inv) => {
    if (filterType !== 'all') {
      if (filterType === 'NC') {
        if (![3, 8, 13].includes(inv.cbte_tipo)) return false
      } else if (inv.invoice_type !== filterType) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const matches =
        (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
        (inv.cae && inv.cae.includes(q)) ||
        (inv.doc_nro && inv.doc_nro.includes(q)) ||
        String(inv.invoice_number).includes(q)
      if (!matches) return false
    }
    if (dateFrom && inv.created_at < dateFrom) return false
    if (dateTo && inv.created_at > dateTo + 'T23:59:59') return false
    return true
  })

  const totalFacturado = filtered.filter(i => !i.voided && ![3, 8, 13].includes(i.cbte_tipo)).reduce((s, i) => s + i.total, 0)
  const totalNC = filtered.filter(i => !i.voided && [3, 8, 13].includes(i.cbte_tipo)).reduce((s, i) => s + i.total, 0)
  const cantFacturas = filtered.filter(i => !i.voided).length

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Comprobantes</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {cantFacturas} comprobantes · Facturado: {formatCurrency(totalFacturado)}
            {totalNC > 0 && <span className="text-red-500"> · NC: -{formatCurrency(totalNC)}</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-4 h-4" /> Filtros
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar por cliente, CAE o nro..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">a</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'A', 'B', 'C', 'NC'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  filterType === t ? 'border-primary bg-green-50 text-primary' : 'border-slate-200 text-muted-foreground hover:text-foreground'
                }`}>
                {t === 'all' ? 'Todos' : t === 'NC' ? 'Notas Crédito' : `Factura ${t}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="Sin comprobantes"
          description="Los comprobantes AFIP aparecerán acá al emitir facturas desde Ventas."
        />
      ) : (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id} className={inv.voided ? 'opacity-50' : ''}>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${getCbteColor(inv.cbte_tipo)}`}>
                      {CBTE_LABELS[inv.cbte_tipo] || `Tipo ${inv.cbte_tipo}`}
                    </span>
                    {inv.voided && <Badge variant="destructive" className="ml-1 text-[9px]">ANULADA</Badge>}
                    {inv.credit_note_for && <Badge variant="warning" className="ml-1 text-[9px]">NC</Badge>}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {padNumber(inv.punto_venta, 5)}-{padNumber(inv.invoice_number, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(inv.created_at)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium truncate max-w-32">{inv.customer_name || '-'}</p>
                    {inv.doc_nro && inv.doc_nro !== '0' && (
                      <p className="text-[10px] text-muted-foreground">Doc: {inv.doc_nro}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {inv.cae ? (
                      <span className="font-mono text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded">{inv.cae}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {[3, 8, 13].includes(inv.cbte_tipo) && <span className="text-red-500">-</span>}
                    {formatCurrency(inv.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(inv)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Ver detalle">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDownloadPDF(inv)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition" title="Descargar PDF">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {!inv.voided && ![3, 8, 13].includes(inv.cbte_tipo) && (
                        <button onClick={() => openNCModal(inv)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition" title="Emitir Nota de Crédito">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!inv.voided && (
                        <button onClick={() => handleVoid(inv)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 transition" title="Anular">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detalle de comprobante" size="md">
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-semibold">{CBTE_LABELS[selectedInvoice.cbte_tipo]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="font-mono font-semibold">{padNumber(selectedInvoice.punto_venta, 5)}-{padNumber(selectedInvoice.invoice_number, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="text-sm">{formatDateTime(selectedInvoice.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="text-sm font-medium">{selectedInvoice.customer_name || 'Consumidor Final'}</p>
              </div>
              {selectedInvoice.iva_condition_customer && (
                <div>
                  <p className="text-xs text-muted-foreground">Cond. IVA cliente</p>
                  <p className="text-sm">{getIvaLabel(selectedInvoice.iva_condition_customer)}</p>
                </div>
              )}
              {selectedInvoice.doc_nro && selectedInvoice.doc_nro !== '0' && (
                <div>
                  <p className="text-xs text-muted-foreground">Documento</p>
                  <p className="text-sm font-mono">{selectedInvoice.doc_nro}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-sm font-semibold">Items</h4>
              {detailItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-1">Descripción</th>
                        <th className="pb-1 text-center">Cant.</th>
                        <th className="pb-1 text-right">P. Unit.</th>
                        <th className="pb-1 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((it) => (
                        <tr key={it.id} className="border-b border-dashed last:border-0">
                          <td className="py-1">{it.description}</td>
                          <td className="py-1 text-center">{it.qty}</td>
                          <td className="py-1 text-right">{formatCurrency(it.unit_price)}</td>
                          <td className="py-1 text-right font-medium">{formatCurrency(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin detalle de items</p>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-sm font-semibold">Detalle fiscal</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-muted-foreground">Neto gravado</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.neto_gravado)}</span>
                </div>
                <div className="flex justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-muted-foreground">IVA 21%</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.iva_amount)}</span>
                </div>
                {selectedInvoice.neto_no_gravado > 0 && (
                  <div className="flex justify-between bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-muted-foreground">No gravado</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.neto_no_gravado)}</span>
                  </div>
                )}
                {selectedInvoice.exento > 0 && (
                  <div className="flex justify-between bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-muted-foreground">Exento</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.exento)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between bg-primary/5 rounded-lg px-3 py-3 text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>

            {selectedInvoice.cae && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Autorización AFIP</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">CAE</span>
                    <span className="font-mono font-bold text-green-800">{selectedInvoice.cae}</span>
                  </div>
                  {selectedInvoice.cae_expiry && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Vencimiento</span>
                      <span className="text-green-800">{selectedInvoice.cae_expiry}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedInvoice.credit_note_for && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-amber-700 text-sm font-medium">Nota de Crédito asociada a factura original</p>
              </div>
            )}

            {selectedInvoice.voided && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-700 font-semibold">Comprobante ANULADO</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDetailModal(false)}>Cerrar</Button>
              <Button className="flex-1" onClick={() => handleDownloadPDF(selectedInvoice)}>
                <Download className="w-4 h-4" /> PDF
              </Button>
              {!selectedInvoice.voided && ![3, 8, 13].includes(selectedInvoice.cbte_tipo) && (
                <Button variant="outline" className="flex-1" onClick={() => { setShowDetailModal(false); openNCModal(selectedInvoice) }}>
                  <RotateCcw className="w-4 h-4" /> NC
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* NC Modal */}
      <Modal open={showNCModal} onClose={() => setShowNCModal(false)} title="Emitir Nota de Crédito" size="sm">
        {ncSourceInvoice && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Factura a anular:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-amber-600">Tipo:</span>{' '}
                  <span className="font-semibold">{CBTE_LABELS[ncSourceInvoice.cbte_tipo]}</span>
                </div>
                <div>
                  <span className="text-amber-600">Nro:</span>{' '}
                  <span className="font-mono font-semibold">{padNumber(ncSourceInvoice.punto_venta, 5)}-{padNumber(ncSourceInvoice.invoice_number, 8)}</span>
                </div>
                <div>
                  <span className="text-amber-600">Cliente:</span>{' '}
                  <span>{ncSourceInvoice.customer_name || 'CF'}</span>
                </div>
                <div>
                  <span className="text-amber-600">Total:</span>{' '}
                  <span className="font-bold">{formatCurrency(ncSourceInvoice.total)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={ncReason}
                onChange={(e) => setNCReason(e.target.value)}
                placeholder="Ej: Devolución de producto"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p>Se emitirá una <strong>Nota de Crédito {ncSourceInvoice.invoice_type}</strong> por el total de <strong>{formatCurrency(ncSourceInvoice.total)}</strong>.</p>
              <p className="mt-1">La factura original quedará marcada como anulada.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowNCModal(false)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={handleEmitNC} disabled={ncProcessing}>
                {ncProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Emitiendo...</> : <><RotateCcw className="w-4 h-4" /> Emitir NC</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { toast } from 'sonner'
import type { Sale, SaleItem, Product, Customer } from '@/types/database'
import {
  Search, Receipt, CreditCard, Banknote,
  ArrowRightLeft, ChevronRight, ShoppingBag,
  CircleDollarSign, Ban, Filter,
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

export default function SalesHistoryPage() {
  const { profile } = useAuthStore()
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [sellerFilter, setSellerFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null)
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    if (!profile?.business_id) return
    fetchSales()
    fetchSellers()

    const channel = supabase.channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${profile.business_id}` }, () => fetchSales())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.business_id, period])

  async function fetchSellers() {
    const { data } = await supabase.from('users').select('id, name').eq('business_id', profile!.business_id)
    setSellers(data || [])
  }

  async function fetchSales() {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, sale_items(*, product:products(*)), customer:customers(*), seller:users!sales_seller_id_fkey(name)')
      .eq('business_id', profile!.business_id)
      .order('created_at', { ascending: false })

    const now = new Date()
    if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      query = query.gte('created_at', start)
    } else if (period === 'week') {
      const start = new Date(now.getTime() - 7 * 86400000).toISOString()
      query = query.gte('created_at', start)
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      query = query.gte('created_at', start)
    }

    const { data } = await query.limit(200)
    setSales((data as unknown as SaleWithItems[]) || [])
    setLoading(false)
  }

  const filtered = sales.filter((s) => {
    if (sellerFilter && s.seller_id !== sellerFilter) return false
    if (paymentFilter && s.payment_method !== paymentFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return s.customer?.name?.toLowerCase().includes(q) ||
      s.sale_items?.some((i: SaleWithItems['sale_items'][number]) => i.product?.name?.toLowerCase().includes(q))
  })

  const totalPeriod = filtered.filter(s => !s.voided).reduce((sum, s) => sum + s.total, 0)

  const periodTabs = [
    { id: 'today' as const, label: 'Hoy' },
    { id: 'week' as const, label: '7 días' },
    { id: 'month' as const, label: 'Mes' },
    { id: 'all' as const, label: 'Todo' },
  ]

  async function handleVoidSale() {
    if (!selectedSale || voiding) return
    if (!confirm('¿Estás seguro de anular esta venta? Se repondrá el stock.')) return
    setVoiding(true)
    try {
      // Mark sale as voided
      await supabase.from('sales').update({
        voided: true,
        voided_at: new Date().toISOString(),
        voided_by: profile!.id,
      }).eq('id', selectedSale.id)

      // Restore stock
      for (const item of selectedSale.sale_items) {
        await supabase.from('products').update({
          stock: item.product.stock + item.quantity,
        }).eq('id', item.product.id)
        await supabase.from('stock_movements').insert({
          business_id: profile!.business_id,
          product_id: item.product.id,
          type: 'adjustment',
          quantity: item.quantity,
          reference_id: selectedSale.id,
          notes: 'Anulación de venta',
        })
      }

      // Reverse customer balance if account payment
      if (selectedSale.payment_method === 'account' && selectedSale.customer_id) {
        const { data: cust } = await supabase.from('customers').select('balance').eq('id', selectedSale.customer_id).single()
        if (cust) {
          await supabase.from('customers').update({
            balance: Math.max(0, cust.balance - selectedSale.total),
          }).eq('id', selectedSale.customer_id)
        }
      }

      toast.success('Venta anulada correctamente')
      setSelectedSale(null)
      fetchSales()
    } catch {
      toast.error('Error al anular la venta')
    } finally {
      setVoiding(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Historial de ventas</h1>
          <p className="text-sm text-muted-foreground">{filtered.filter(s => !s.voided).length} ventas — Total: {formatCurrency(totalPeriod)}</p>
        </div>
      </div>

      {/* Period tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-muted rounded-xl p-1 gap-1 shrink-0">
          {periodTabs.map((t) => (
            <button key={t.id} onClick={() => setPeriod(t.id)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                period === t.id ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por cliente o producto..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filtros:
        </div>
        <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}
          className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Todos los vendedores</option>
          {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
          className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Todos los pagos</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(sellerFilter || paymentFilter) && (
          <button onClick={() => { setSellerFilter(''); setPaymentFilter('') }}
            className="h-8 px-2 text-xs text-destructive hover:underline">Limpiar</button>
        )}
      </div>

      {/* Sales list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm text-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-15" />
          <p className="text-sm font-medium">Sin ventas en este período</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-100">
          {filtered.map((sale) => {
            const Icon = PAYMENT_ICONS[sale.payment_method] || ArrowRightLeft
            return (
              <button key={sale.id} onClick={() => setSelectedSale(sale)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition text-left ${sale.voided ? 'opacity-50' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sale.voided ? 'bg-red-50' : 'bg-slate-50'}`}>
                  {sale.voided ? <Ban className="w-4 h-4 text-red-500" /> : <ShoppingBag className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">
                      {sale.sale_items?.map((i: SaleWithItems['sale_items'][number]) => i.product?.name).filter(Boolean).join(', ') || 'Venta'}
                    </p>
                    {sale.voided && <Badge variant="destructive" className="text-[10px]">Anulada</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      {' '}
                      {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {sale.customer && <span className="text-xs text-muted-foreground">• {sale.customer.name}</span>}
                    {sale.seller && <span className="text-xs text-muted-foreground">• {sale.seller.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${sale.voided ? 'text-red-400 line-through' : 'text-foreground'}`}>{formatCurrency(sale.total)}</p>
                    <div className="flex items-center gap-1 text-muted-foreground justify-end">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selectedSale} onClose={() => setSelectedSale(null)} title="Detalle de venta" size="md">
        {selectedSale && (
          <div className="space-y-4">
            {selectedSale.voided && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium text-center">
                Venta anulada {selectedSale.voided_at && `el ${new Date(selectedSale.voided_at).toLocaleDateString('es-AR')}`}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(selectedSale.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}
                {new Date(selectedSale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge>
                <span className="flex items-center gap-1">{PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}</span>
              </Badge>
            </div>

            {selectedSale.customer && (
              <div className="bg-muted rounded-xl p-3 text-sm">
                <span className="text-muted-foreground">Cliente:</span>{' '}
                <span className="font-medium">{selectedSale.customer.name}</span>
              </div>
            )}

            {selectedSale.seller && (
              <div className="text-xs text-muted-foreground">
                Vendedor: <span className="font-medium text-foreground">{selectedSale.seller.name}</span>
              </div>
            )}

            {selectedSale.receipt_type && selectedSale.receipt_type !== 'ticket' && (
              <div className="text-xs text-muted-foreground">
                Comprobante: <span className="font-medium text-foreground">Factura {selectedSale.receipt_type}</span>
              </div>
            )}

            <div className="space-y-2">
              {selectedSale.sale_items?.map((item: SaleWithItems['sale_items'][number]) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.product?.name || 'Producto'}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatCurrency(item.quantity * item.price)}</span>
                </div>
              ))}
            </div>

            {selectedSale.discount > 0 && (
              <div className="flex items-center justify-between text-sm text-amber-600">
                <span>Descuento ({selectedSale.discount}%)</span>
                <span>-{formatCurrency(selectedSale.total * selectedSale.discount / (100 - selectedSale.discount))}</span>
              </div>
            )}

            {selectedSale.surcharge_pct > 0 && (
              <div className="flex items-center justify-between text-sm text-blue-600">
                <span>Recargo ({selectedSale.surcharge_pct}%)</span>
                <span>+recargo incluido</span>
              </div>
            )}

            {selectedSale.installments > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Cuotas</span>
                <span>{selectedSale.installments}x {formatCurrency(selectedSale.total / selectedSale.installments)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-lg font-bold">Total</span>
              <span className={`text-lg font-bold ${selectedSale.voided ? 'text-red-400 line-through' : 'text-primary'}`}>{formatCurrency(selectedSale.total)}</span>
            </div>

            {/* Void button */}
            {!selectedSale.voided && profile?.role === 'admin' && (
              <Button variant="destructive" className="w-full" onClick={handleVoidSale} disabled={voiding}>
                <Ban className="w-4 h-4" />
                {voiding ? 'Anulando...' : 'Anular venta'}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

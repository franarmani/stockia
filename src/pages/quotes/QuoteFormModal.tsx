import { useState, useEffect, useMemo } from 'react'
import { quotesDb } from '@/lib/quotesDb'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { Quote, QuoteItem, Customer, Product } from '@/types/database'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Search, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

/** Línea en edición: el precio arranca del producto pero se puede pisar. */
interface DraftItem {
  productId: string | null
  description: string
  quantity: number
  price: number
}

interface QuoteFormModalProps {
  open: boolean
  onClose: () => void
  quote: Quote | null
  customers: Customer[]
  products: Product[]
  onSaved: () => void
  loadItems: (quoteId: string) => Promise<QuoteItem[]>
}

/** Por defecto los presupuestos valen 15 días. */
function defaultValidUntil(): string {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return d.toISOString().slice(0, 10)
}

export default function QuoteFormModal({
  open, onClose, quote, customers, products, onSaved, loadItems,
}: QuoteFormModalProps) {
  const { profile } = useAuthStore()

  const [customerId, setCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [validUntil, setValidUntil] = useState(defaultValidUntil())
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Al abrir: cargar el presupuesto a editar, o limpiar para uno nuevo.
  useEffect(() => {
    if (!open) return
    if (quote) {
      setCustomerId(quote.customer_id || '')
      setCustomerName(quote.customer_name || '')
      setCustomerPhone(quote.customer_phone || '')
      setValidUntil(quote.valid_until || defaultValidUntil())
      setDiscount(Number(quote.discount))
      setNotes(quote.notes || '')
      loadItems(quote.id).then(rows => {
        setItems(rows.map(r => ({
          productId: r.product_id,
          description: r.description,
          quantity: Number(r.quantity),
          price: Number(r.price),
        })))
      })
    } else {
      setCustomerId('')
      setCustomerName('')
      setCustomerPhone('')
      setValidUntil(defaultValidUntil())
      setDiscount(0)
      setNotes('')
      setItems([])
    }
    setProductSearch('')
  }, [open, quote?.id])

  function selectCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find(c => c.id === id)
    if (c) {
      setCustomerName(c.name)
      setCustomerPhone(c.phone || '')
    }
  }

  const productResults = useMemo(() => {
    if (!productSearch.trim()) return []
    const s = productSearch.toLowerCase()
    return products
      .filter(p => p.name.toLowerCase().includes(s) || (p.barcode || '').includes(s))
      .slice(0, 8)
  }, [productSearch, products])

  function addProduct(p: Product) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, {
        productId: p.id,
        description: p.name,
        quantity: 1,
        price: Number(p.sale_price) || 0,
      }]
    })
    setProductSearch('')
  }

  function addFreeItem() {
    setItems(prev => [...prev, { productId: null, description: '', quantity: 1, price: 0 }])
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...patch } : it))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  )
  const total = subtotal * (1 - discount / 100)

  async function handleSave() {
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return }
    if (items.some(i => !i.description.trim())) { toast.error('Todas las líneas necesitan una descripción'); return }
    if (!customerName.trim()) { toast.error('Indicá a quién va dirigido el presupuesto'); return }

    setSaving(true)
    try {
      const payload = {
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        subtotal,
        discount,
        total,
        valid_until: validUntil || null,
        notes: notes.trim() || null,
      }

      let quoteId: string

      if (quote) {
        const { error } = await quotesDb.from('quotes').update(payload).eq('id', quote.id)
        if (error) throw error
        quoteId = quote.id
        // Los ítems se reemplazan completos: es más simple y seguro que
        // diferenciar altas, bajas y modificaciones línea por línea.
        const { error: delErr } = await quotesDb.from('quote_items').delete().eq('quote_id', quoteId)
        if (delErr) throw delErr
      } else {
        const { data: numData, error: numErr } = await quotesDb
          .rpc('next_quote_number', { p_business_id: profile!.business_id })
        if (numErr) throw numErr

        const { data, error } = await quotesDb
          .from('quotes')
          .insert({
            ...payload,
            business_id: profile!.business_id,
            quote_number: numData,
            status: 'pending',
            seller_id: profile!.id,
          })
          .select('id')
          .single()
        if (error) throw error
        quoteId = data.id
      }

      const { error: itemsErr } = await quotesDb.from('quote_items').insert(
        items.map(i => ({
          quote_id: quoteId,
          product_id: i.productId,
          description: i.description.trim(),
          quantity: i.quantity,
          price: i.price,
        }))
      )
      if (itemsErr) throw itemsErr

      toast.success(quote ? 'Presupuesto actualizado' : 'Presupuesto creado')
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el presupuesto')
    }
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quote ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      size="xl"
    >
      <div className="space-y-5">
        {/* Cliente */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cliente</label>
            <select
              value={customerId}
              onChange={(e) => selectCustomer(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— Cliente ocasional —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Nombre en el presupuesto"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="A quién va dirigido"
          />
          <Input
            label="Teléfono (para WhatsApp)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Ej. 1145678900"
          />
          <Input
            label="Válido hasta"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        {/* Buscador de productos */}
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Agregar producto"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nombre o código"
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button variant="outline" onClick={addFreeItem} title="Agregar una línea libre">
              <Plus className="w-4 h-4" /> Línea libre
            </Button>
          </div>

          {productResults.length > 0 && (
            <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
              {productResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 transition text-left"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap ml-3">
                    {formatCurrency(Number(p.sale_price))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ítems cargados */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Productos ({items.length})
          </p>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center rounded-xl border border-dashed border-white/10">
              Buscá un producto arriba para agregarlo al presupuesto.
            </p>
          ) : (
            <div className="rounded-xl border border-white/10 divide-y divide-white/5">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Descripción"
                      className="flex-1 h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(idx)}
                      title="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-muted-foreground">Cant.</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      className="w-20 h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <label className="text-xs text-muted-foreground ml-2">Precio</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                      className="w-28 h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="ml-auto text-sm font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y notas */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Observaciones</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Condiciones de entrega, formas de pago, aclaraciones…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="space-y-2">
            <Input
              label="Descuento general (%)"
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
            <div className="rounded-xl border border-white/10 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento {discount}%</span>
                  <span>-{formatCurrency(subtotal * discount / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-white/10">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : quote ? 'Guardar cambios' : 'Crear presupuesto'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

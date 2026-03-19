import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Customer, Sale } from '@/types/database'
import { IVA_CONDITIONS, DOC_TIPOS } from '@/types/database'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Search,
  Users,
  Edit,
  Trash2,
  History,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react'

const customerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  doc_tipo: z.string().optional(),
  doc_nro: z.string().optional(),
  iva_condition: z.string().optional(),
})

type CustomerForm = z.infer<typeof customerSchema>

export default function CustomersPage() {
  const { profile } = useAuthStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [customerPayments, setCustomerPayments] = useState<{ id: string; amount: number; description: string; created_at: string }[]>([])

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  })

  useEffect(() => {
    if (profile?.business_id) fetchCustomers()
  }, [profile?.business_id])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', profile!.business_id)
      .order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  function openCreate() {
    setEditingCustomer(null)
    reset({ name: '', phone: '', email: '', address: '', doc_tipo: '99', doc_nro: '', iva_condition: 'consumidor_final' })
    setShowModal(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setValue('name', customer.name)
    setValue('phone', customer.phone || '')
    setValue('email', customer.email || '')
    setValue('address', customer.address || '')
    setValue('doc_tipo', (customer as any).doc_tipo || '99')
    setValue('doc_nro', (customer as any).doc_nro || '')
    setValue('iva_condition', (customer as any).iva_condition || 'consumidor_final')
    setShowModal(true)
  }

  async function viewHistory(customer: Customer) {
    setSelectedCustomer(customer)
    const [salesRes, paymentsRes] = await Promise.all([
      supabase.from('sales').select('*').eq('business_id', profile!.business_id).eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_payments').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
    ])
    setCustomerSales(salesRes.data || [])
    setCustomerPayments((paymentsRes.data as { id: string; amount: number; description: string; created_at: string }[]) || [])
    setShowHistoryModal(true)
  }

  function openPayment(customer: Customer) {
    setSelectedCustomer(customer)
    setPaymentAmount('')
    setPaymentDescription('')
    setShowPaymentModal(true)
  }

  async function handlePayment() {
    if (!selectedCustomer || !paymentAmount) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido')
      return
    }

    // Record in customer_payments table
    const { error: payErr } = await supabase.from('customer_payments').insert({
      customer_id: selectedCustomer.id,
      amount,
      description: paymentDescription || 'Pago de deuda',
    })
    if (payErr) {
      toast.error('Error al registrar pago')
      return
    }

    // Update balance
    const newBalance = Math.max(0, selectedCustomer.balance - amount)
    await supabase.from('customers').update({ balance: newBalance }).eq('id', selectedCustomer.id)

    toast.success(`Pago de ${formatCurrency(amount)} registrado`)
    setShowPaymentModal(false)
    fetchCustomers()
  }

  async function onSubmit(data: CustomerForm) {
    const baseFields = {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    }
    const afipFields = {
      doc_tipo: data.doc_tipo || '99',
      doc_nro: data.doc_nro || null,
      iva_condition: data.iva_condition || 'consumidor_final',
    }

    if (editingCustomer) {
      // Try with AFIP fields first; fall back to base fields if columns don't exist (migration not applied)
      let { error } = await supabase
        .from('customers')
        .update({ ...baseFields, ...afipFields })
        .eq('id', editingCustomer.id)
      if (error?.code === 'PGRST204' || error?.message?.includes('column')) {
        // AFIP columns not in DB yet — update base fields only
        const fallback = await supabase.from('customers').update(baseFields).eq('id', editingCustomer.id)
        error = fallback.error
      }
      if (error) {
        toast.error('Error al actualizar')
        console.error(error)
        return
      }
      toast.success('Cliente actualizado')
    } else {
      const insertPayload = {
        ...baseFields,
        ...afipFields,
        business_id: profile!.business_id,
        balance: 0,
      }
      let { error } = await supabase.from('customers').insert(insertPayload)
      if (error?.code === 'PGRST204' || error?.message?.includes('column')) {
        // Fall back without AFIP fields
        const fallback = await supabase.from('customers').insert({ ...baseFields, business_id: profile!.business_id, balance: 0 })
        error = fallback.error
      }
      if (error) {
        toast.error('Error al crear cliente')
        console.error(error)
        return
      }
      toast.success('Cliente creado')
    }

    setShowModal(false)
    fetchCustomers()
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Eliminar "${customer.name}"?`)) return
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id)
    if (error) {
      toast.error('Error al eliminar (puede tener ventas asociadas)')
      return
    }
    toast.success('Cliente eliminado')
    fetchCustomers()
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    ((c as any).doc_nro && (c as any).doc_nro.includes(search))
  )

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{customers.length} clientes registrados</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Nuevo cliente
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre, teléfono o email..."
        icon={<Search className="w-4 h-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No hay clientes"
          description="Agregá tu primer cliente para llevar el registro de compras y cuenta corriente."
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Nuevo cliente</Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {IVA_CONDITIONS.find(c => c.id === (customer as any).iva_condition)?.label || 'Consumidor Final'}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {(customer as any).doc_nro ? (
                      <div className="flex items-center gap-1 text-xs">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{DOC_TIPOS.find(d => String(d.id) === (customer as any).doc_tipo)?.code || 'Doc'}: {(customer as any).doc_nro}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                    {customer.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{customer.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {customer.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />{customer.email}
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-50">{customer.address}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {customer.balance > 0 ? (
                    <Badge variant="destructive">{formatCurrency(customer.balance)}</Badge>
                  ) : (
                    <Badge variant="success">Al día</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => viewHistory(customer)} title="Historial">
                      <History className="w-4 h-4" />
                    </Button>
                    {customer.balance > 0 && (
                      <Button variant="ghost" size="icon" onClick={() => openPayment(customer)} title="Registrar pago">
                        <DollarSign className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(customer)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre *" error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Tipo doc.</label>
              <select
                {...register('doc_tipo')}
                className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              >
                {DOC_TIPOS.map(d => <option key={d.id} value={d.id} className="bg-[#07142f]">{d.label}</option>)}
              </select>
            </div>
            <Input label="Nro. documento" {...register('doc_nro')} placeholder="Ej: 20-12345678-9" />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1.5">Cond. IVA</label>
            <select
              {...register('iva_condition')}
              className="w-full h-10 px-3 rounded-xl border border-white/15 bg-white/8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
            >
              {IVA_CONDITIONS.map(c => <option key={c.id} value={c.id} className="bg-[#07142f]">{c.label}</option>)}
            </select>
          </div>
          <Input label="Teléfono" {...register('phone')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Dirección" {...register('address')} />
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 h-10 rounded-xl border border-white/12 bg-white/6 text-white/70 font-semibold text-sm hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/20"
            >
              {editingCustomer ? 'Actualizar' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title={`Historial - ${selectedCustomer?.name}`} size="lg">
        <div className="space-y-4">
          {selectedCustomer && selectedCustomer.balance > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-[11px] text-red-500">Deuda pendiente</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(selectedCustomer.balance)}</p>
            </div>
          )}

          {customerPayments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Pagos registrados</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDateTime(p.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.description}</TableCell>
                      <TableCell className="font-semibold text-green-600">+{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Compras</h3>
            {customerSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay compras registradas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                      <TableCell><Badge variant="outline">{sale.payment_method}</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(sale.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Registrar pago" size="sm">
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">Deuda actual</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(selectedCustomer?.balance || 0)}</p>
          </div>
          <Input
            label="Monto a pagar"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Descripción (opcional)"
            value={paymentDescription}
            onChange={(e) => setPaymentDescription(e.target.value)}
            placeholder="Ej: Pago parcial, transferencia"
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handlePayment}>Registrar pago</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalCustomers } from '@/sync/storage'
import { isOnline, withSyncNote } from '@/sync/connectivity'
import { cachedQuery } from '@/sync/remote'
import { usePlan } from '@/hooks/usePlan'
import { creditScore, GRADE_STYLES, type ChargeLite } from '@/features/customers/creditScore'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { downloadStatementExcel, downloadStatementPdf, loadStatement } from '@/features/customers/accountStatement'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { SkeletonTable } from '@/components/ui/Skeleton'
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
  credit_limit: z.string().optional(),
  is_wholesale: z.boolean().optional(),
})

type CustomerForm = z.infer<typeof customerSchema>

export default function CustomersPage() {
  const { profile } = useAuthStore()
  const { isPremium } = usePlan()
  const [customers, setCustomers] = useState<Customer[]>([])
  // Cargos de cuenta corriente del último año, para calificar a cada cliente (Premium).
  const [chargesByCustomer, setChargesByCustomer] = useState<Map<string, ChargeLite[]>>(new Map())
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
    if (!profile?.business_id) return
    fetchCustomers()
    return syncEngine.onSynced(() => { fetchCustomers() })
  }, [profile?.business_id])

  // Primero lo que hay en este equipo (instantáneo y sin conexión), después el servidor.
  async function fetchCustomers() {
    try {
      await syncEngine.init()
      const sortByName = (list: Customer[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      const local = await getLocalCustomers(profile!.business_id)
      if (local.length > 0) {
        setCustomers(sortByName(local as Customer[]))
        setLoading(false)
      }
      const fresh = await syncEngine.pullLatestCustomers(profile!.business_id)
      setCustomers(sortByName(fresh as Customer[]))
      if (isPremium) loadCharges()
    } catch (error) {
      console.error('[Customers] Error loading customers:', error)
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  async function loadCharges() {
    const businessId = profile!.business_id
    const since = new Date(Date.now() - 365 * 86400000).toISOString()
    const { data } = await cachedQuery(`account_charges:${businessId}`, (supabase as any)
      .from('account_movements')
      .select('customer_id, amount, created_at')
      .eq('business_id', businessId)
      .eq('type', 'charge')
      .gte('created_at', since)
      .limit(10000))
    const map = new Map<string, ChargeLite[]>()
    for (const row of (data as any[]) ?? []) {
      const list = map.get(row.customer_id) ?? []
      list.push({ amount: Number(row.amount) || 0, created_at: row.created_at })
      map.set(row.customer_id, list)
    }
    setChargesByCustomer(map)
  }

  function openCreate() {
    setEditingCustomer(null)
    reset({ name: '', phone: '', email: '', address: '', doc_tipo: '99', doc_nro: '', iva_condition: 'consumidor_final', credit_limit: '', is_wholesale: false })
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
    setValue('credit_limit', (customer as any).credit_limit ? String((customer as any).credit_limit) : '')
    setValue('is_wholesale', !!(customer as any).is_wholesale)
    setShowModal(true)
  }

  async function viewHistory(customer: Customer) {
    if (!isOnline()) {
      toast.info('El historial del cliente se consulta en el servidor. Disponible al volver la conexión.')
      return
    }
    setSelectedCustomer(customer)
    const [salesRes, paymentsRes] = await Promise.all([
      supabase.from('sales').select('*').eq('business_id', profile!.business_id).eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_payments').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
    ])
    setCustomerSales(salesRes.data || [])
    setCustomerPayments((paymentsRes.data || []).map(payment => ({
      id: payment.id,
      amount: payment.amount,
      description: payment.notes || '',
      created_at: payment.created_at,
    })))
    setShowHistoryModal(true)
  }

  async function exportStatement(format: 'pdf' | 'excel') {
    if (!selectedCustomer) return
    if (!isOnline()) { toast.info('El estado de cuenta se arma con los datos del servidor. Disponible al volver la conexión.'); return }
    try {
      const rows = await loadStatement(profile!.business_id, selectedCustomer.id)
      const balance = Number(selectedCustomer.balance) || 0
      if (format === 'excel') downloadStatementExcel(selectedCustomer.name, rows, balance)
      else await downloadStatementPdf(useBusinessStore.getState().business?.name ?? '', selectedCustomer.name, rows, balance)
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el estado de cuenta')
    }
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

    try {
      await syncEngine.recordCustomerPayment(
        profile!.business_id,
        profile!.id,
        { id: selectedCustomer.id, balance: Number(selectedCustomer.balance) || 0 },
        amount,
        paymentDescription || 'Pago de deuda'
      )
    } catch (error) {
      console.error('[Customers] payment failed:', error)
      toast.error('Error al registrar pago')
      return
    }

    toast.success(withSyncNote(`Pago de ${formatCurrency(amount)} registrado`))
    setShowPaymentModal(false)
    fetchCustomers()
  }

  async function onSubmit(data: CustomerForm) {
    const baseFields = {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      is_wholesale: !!data.is_wholesale,
    }
    const afipFields = {
      doc_tipo: data.doc_tipo || '99',
      doc_nro: data.doc_nro || null,
      iva_condition: data.iva_condition || 'consumidor_final',
      // Límite de crédito para ventas a cuenta (0 = sin límite). Solo se edita en Premium.
      ...(isPremium ? { credit_limit: Math.max(0, Number(data.credit_limit) || 0) } : {}),
    }

    // Se guarda local y se sincroniza (el motor reintenta sin columnas AFIP en bases viejas).
    try {
      if (editingCustomer) {
        await syncEngine.updateRow('customers', profile!.business_id, editingCustomer.id, { ...baseFields, ...afipFields })
        toast.success(withSyncNote('Cliente actualizado'))
      } else {
        await syncEngine.createRow('customers', profile!.business_id, {
          id: crypto.randomUUID(),
          ...baseFields,
          ...afipFields,
          balance: 0,
          created_at: new Date().toISOString(),
        })
        toast.success(withSyncNote('Cliente creado'))
      }
    } catch (error) {
      console.error(error)
      toast.error(editingCustomer ? 'Error al actualizar' : 'Error al crear cliente')
      return
    }

    setShowModal(false)
    fetchCustomers()
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Eliminar "${customer.name}"?`)) return
    try {
      await syncEngine.deleteRow('customers', profile!.business_id, customer.id)
    } catch {
      toast.error('Error al eliminar')
      return
    }
    // Si tiene ventas asociadas, el servidor lo rechaza y queda marcado para revisar.
    toast.success(withSyncNote('Cliente eliminado'))
    fetchCustomers()
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    ((c as any).doc_nro && (c as any).doc_nro.includes(search))
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Clientes</h1>
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

      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
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
                  {(customer as any).is_wholesale && <Badge variant="outline" className="mr-1">Mayorista</Badge>}
                  {customer.balance > 0 ? (
                    <Badge variant="destructive">{formatCurrency(customer.balance)}</Badge>
                  ) : (
                    <Badge variant="success">Al día</Badge>
                  )}
                  {isPremium && (() => {
                    const limit = Number((customer as any).credit_limit) || 0
                    const score = creditScore({ balance: Number(customer.balance) || 0, creditLimit: limit, charges: chargesByCustomer.get(customer.id) ?? [] })
                    return (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${GRADE_STYLES[score.grade]}`}
                          title={score.oldestUnpaidDays > 0 ? `Deuda más vieja: ${score.oldestUnpaidDays} días` : 'Sin deuda'}
                        >
                          {score.grade} · {score.label}
                        </span>
                        {limit > 0 && (
                          <span className={`text-[10px] ${score.overLimit ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
                            Límite {formatCurrency(limit)}
                          </span>
                        )}
                      </div>
                    )
                  })()}
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
          {isPremium && (
            <Input
              label="Límite de crédito en cuenta corriente ($, vacío = sin límite)"
              type="number"
              min={0}
              {...register('credit_limit')}
            />
          )}
          <label className="flex items-center gap-2.5 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-[#6178ee]" {...register('is_wholesale')} />
            Cliente mayorista (se le cobra el precio mayorista de cada producto)
          </label>
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-white/40 mr-auto">Estado de cuenta corriente</span>
            <Button variant="outline" size="sm" onClick={() => exportStatement('pdf')}>Descargar PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportStatement('excel')}>Descargar Excel</Button>
          </div>
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

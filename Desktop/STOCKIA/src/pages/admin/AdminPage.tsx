import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  Users, CheckCircle2, Clock, XCircle,
  Search, RefreshCw, MessageCircle, LogOut,
  Building2, TrendingUp, AlertTriangle, Copy,
  CreditCard, ImageIcon, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const WA_NUMBER = '5492915716099'
const ALIAS = 'farmani2.ppay'

/* ─── Types ─── */
interface BusinessRow {
  id: string
  name: string
  email: string
  phone: string | null
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  created_at: string
  cuit: string | null
}

interface PaymentRequest {
  id: string
  business_id: string
  user_id: string
  amount: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  reviewed_at: string | null
  created_at: string
  business?: { name: string; email: string }
}

function statusLabel(b: BusinessRow) {
  if (b.subscription_status === 'active') return 'Activo'
  if (b.subscription_status === 'expired') return 'Vencido'
  if (b.subscription_status === 'trial') {
    if (b.trial_ends_at && new Date(b.trial_ends_at) < new Date()) return 'Trial vencido'
    return 'Trial'
  }
  return b.subscription_status
}

function statusColor(b: BusinessRow): string {
  const s = statusLabel(b)
  if (s === 'Activo') return 'bg-green-500/15 text-green-400 border-green-500/25'
  if (s === 'Trial') return 'bg-blue-500/15 text-blue-400 border-blue-500/25'
  if (s === 'Trial vencido') return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
  return 'bg-red-500/15 text-red-400 border-red-500/25'
}

/* ─── Main Component ─── */
export default function AdminPage() {
  const { profile, user, signOut } = useAuthStore()
  const [tab, setTab] = useState<'businesses' | 'payments'>('businesses')
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'trial' | 'active' | 'expired'>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  const isSuperadmin = !!profile?.is_superadmin

  useEffect(() => {
    if (!isSuperadmin) return
    fetchAll()
    fetchPaymentRequests()
  }, [isSuperadmin])

  // Guard: only superadmin (AFTER hooks to comply with React rules)
  if (!profile) return null
  if (!isSuperadmin) return <Navigate to="/menu" replace />

  async function fetchPaymentRequests() {
    setLoadingPayments(true)
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*, business:businesses(name, email)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Error cargando solicitudes: ' + error.message)
    else setPaymentRequests(data ?? [])
    setLoadingPayments(false)
  }

  async function approvePayment(req: PaymentRequest) {
    setUpdating(req.id)
    const { error: reqErr } = await supabase
      .from('payment_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', req.id)
    if (reqErr) { toast.error(reqErr.message); setUpdating(null); return }
    await supabase
      .from('businesses')
      .update({ subscription_status: 'active' })
      .eq('id', req.business_id)
    toast.success('✅ Pago aprobado y cuenta activada')
    setPaymentRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r))
    setUpdating(null)
  }

  async function rejectPayment(req: PaymentRequest) {
    setUpdating(req.id)
    const { error } = await supabase
      .from('payment_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { toast.error(error.message); setUpdating(null); return }
    toast.success('Solicitud rechazada')
    setPaymentRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))
    setUpdating(null)
  }

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, email, phone, plan, subscription_status, trial_ends_at, created_at, cuit')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error cargando negocios: ' + error.message)
    } else {
      setBusinesses(data ?? [])
    }
    setLoading(false)
  }

  async function setStatus(id: string, status: 'active' | 'expired') {
    setUpdating(id)
    const updates: Partial<BusinessRow> =
      status === 'active'
        ? { subscription_status: 'active' }
        : { subscription_status: 'expired' }

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success(status === 'active' ? '✅ Cuenta activada' : '🔒 Cuenta desactivada')
      setBusinesses(prev =>
        prev.map(b => b.id === id ? { ...b, subscription_status: status } : b)
      )
    }
    setUpdating(null)
  }

  function openWA(business: BusinessRow, type: 'activar' | 'vencido') {
    const msg = type === 'activar'
      ? `Hola! Tu cuenta en STOCKIA ha sido activada ✅. Ya podés ingresar en https://stockia-two.vercel.app — Cualquier consulta avisame. Saludos, Fran`
      : `Hola! Tu período de prueba en STOCKIA ha vencido 📅. Para seguir usando el sistema transferí $50.000 al alias *${ALIAS}* y avisame por acá. Saludos, Fran`

    const phone = business.phone?.replace(/\D/g, '') || ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function copyAlias() {
    navigator.clipboard.writeText(ALIAS)
    toast.success('Alias copiado: ' + ALIAS)
  }

  // Stats
  const total = businesses.length
  const activos = businesses.filter(b => b.subscription_status === 'active').length
  const trials = businesses.filter(b => b.subscription_status === 'trial' && (!b.trial_ends_at || new Date(b.trial_ends_at) >= new Date())).length
  const vencidos = businesses.filter(b =>
    b.subscription_status === 'expired' ||
    (b.subscription_status === 'trial' && !!b.trial_ends_at && new Date(b.trial_ends_at) < new Date())
  ).length
  const pendingPayments = paymentRequests.filter(r => r.status === 'pending').length

  // Filter + search
  const filtered = businesses.filter(b => {
    const matchSearch = !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.email.toLowerCase().includes(search.toLowerCase()) ||
      (b.phone ?? '').includes(search)

    const st = statusLabel(b)
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? st === 'Activo' :
      filter === 'trial' ? (st === 'Trial' || st === 'Trial vencido') :
      filter === 'expired' ? (st === 'Vencido' || st === 'Trial vencido') :
      true

    return matchSearch && matchFilter
  })

  return (
    <div className="min-h-screen app-bg text-white">

      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Panel Admin — STOCKIA</h1>
              <p className="text-[10px] text-white/35">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Alias de cobro */}
            <button
              onClick={copyAlias}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass-card text-xs text-white/60 hover:text-white rounded-xl transition-colors"
            >
              <Copy className="w-3 h-3" />
              {ALIAS}
            </button>
            <button
              onClick={fetchAll}
              className="w-8 h-8 glass-card rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingPayments ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={signOut}
              className="w-8 h-8 glass-card rounded-xl flex items-center justify-center text-white/50 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Alias banner */}
        <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-green-500/20 bg-green-500/5">
          <div>
            <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-0.5">Alias de cobro</p>
            <p className="text-lg font-black text-white tracking-wide">{ALIAS}</p>
            <p className="text-xs text-white/35">$50.000 / mes — Plan Negocio</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAlias}
              className="inline-flex items-center gap-1.5 px-4 py-2 glass-card text-sm text-white/70 hover:text-white rounded-xl transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar alias
            </button>
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Mi WA
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total negocios', val: total, icon: Users, color: 'text-white' },
            { label: 'Activos', val: activos, icon: CheckCircle2, color: 'text-green-400' },
            { label: 'En trial', val: trials, icon: Clock, color: 'text-blue-400' },
            { label: 'Vencidos', val: vencidos, icon: XCircle, color: 'text-red-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-[11px] text-white/35">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('businesses')}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold transition-colors ${tab === 'businesses' ? 'gradient-primary text-white' : 'glass-card text-white/50 hover:text-white'}`}
          >
            <Building2 className="w-4 h-4" />
            Negocios
          </button>
          <button
            onClick={() => setTab('payments')}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold transition-colors ${tab === 'payments' ? 'gradient-primary text-white' : 'glass-card text-white/50 hover:text-white'}`}
          >
            <CreditCard className="w-4 h-4" />
            Solicitudes de pago
            {pendingPayments > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {pendingPayments}
              </span>
            )}
          </button>
        </div>

        {tab === 'payments' ? (
          /* ─── Payment Requests Tab ─── */
          <div className="glass-card overflow-hidden">
            {loadingPayments ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 text-white/30 animate-spin" />
              </div>
            ) : paymentRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <CreditCard className="w-8 h-8 text-white/20" />
                <p className="text-sm text-white/30">No hay solicitudes de pago</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Negocio</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Monto</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Comprobante</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Fecha</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRequests.map((req, i) => (
                      <tr key={req.id} className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/1'}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-white">{req.business?.name ?? '—'}</p>
                          <p className="text-[11px] text-white/30">{req.business?.email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/70 font-semibold">{req.amount}</td>
                        <td className="px-4 py-3">
                          {req.proof_url ? (
                            <a href={req.proof_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-xs font-semibold transition-colors">
                              <ImageIcon className="w-3.5 h-3.5" />
                              Ver imagen
                            </a>
                          ) : (
                            <span className="text-white/25 text-xs">Sin comprobante</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            req.status === 'approved' ? 'bg-green-500/15 text-green-400 border-green-500/25' :
                            req.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                            'bg-amber-500/15 text-amber-400 border-amber-500/25'
                          }`}>
                            {req.status === 'approved' ? 'Aprobado' : req.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">
                          {format(new Date(req.created_at), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                disabled={updating === req.id}
                                onClick={() => approvePayment(req)}
                                className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/35 text-green-400 text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                {updating === req.id ? '...' : 'Aprobar'}
                              </button>
                              <button
                                disabled={updating === req.id}
                                onClick={() => rejectPayment(req)}
                                className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                {updating === req.id ? '...' : 'Rechazar'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
        {/* Filtros + búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="w-full pl-9 pr-4 h-10 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-green-500/50"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'active', 'trial', 'expired'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-10 rounded-xl text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'gradient-primary text-white'
                    : 'glass-card text-white/50 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : f === 'trial' ? 'Trial' : 'Vencidos'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-white/30 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <AlertTriangle className="w-8 h-8 text-white/20" />
              <p className="text-sm text-white/30">No se encontraron resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Negocio</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Contacto</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Trial hasta</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Registro</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => {
                    const st = statusLabel(b)
                    const isExpiredOrTrialExpired = st === 'Vencido' || st === 'Trial vencido'
                    const isActive = st === 'Activo'
                    return (
                      <tr key={b.id} className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/1'}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-white">{b.name}</p>
                          {b.cuit && <p className="text-[11px] text-white/30">CUIT: {b.cuit}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-white/60">{b.email}</p>
                          {b.phone && <p className="text-[11px] text-white/30">{b.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusColor(b)}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">
                          {b.trial_ends_at
                            ? format(new Date(b.trial_ends_at), "d MMM yyyy", { locale: es })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">
                          {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp */}
                            <button
                              onClick={() => openWA(b, isExpiredOrTrialExpired ? 'vencido' : 'activar')}
                              className="w-8 h-8 rounded-lg bg-green-600/20 hover:bg-green-600/40 flex items-center justify-center text-green-400 transition-colors"
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* Activar */}
                            {!isActive && (
                              <button
                                disabled={updating === b.id}
                                onClick={() => setStatus(b.id, 'active')}
                                className="px-2.5 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/35 text-green-400 text-xs font-bold transition-colors disabled:opacity-50"
                                title="Activar cuenta"
                              >
                                {updating === b.id ? '...' : 'Activar'}
                              </button>
                            )}

                            {/* Desactivar */}
                            {isActive && (
                              <button
                                disabled={updating === b.id}
                                onClick={() => setStatus(b.id, 'expired')}
                                className="px-2.5 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors disabled:opacity-50"
                                title="Desactivar cuenta"
                              >
                                {updating === b.id ? '...' : 'Desactivar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instrucciones */}
        <div className="glass-card p-5 border border-amber-500/15 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-amber-400">Cómo activar un cliente que pagó</p>
              <ol className="text-xs text-white/50 space-y-1 list-decimal ml-4">
                <li>El cliente te escribe por WhatsApp confirmando la transferencia al alias <span className="text-white font-medium">{ALIAS}</span></li>
                <li>Verificás el pago en tu banco/billetera</li>
                <li>Buscás su negocio en esta tabla y presionás <span className="text-green-400 font-semibold">Activar</span></li>
                <li>Opcionalmente le mandás un WA de confirmación con el botón verde</li>
              </ol>
            </div>
          </div>
        </div>
          </>
        )}

      </div>
    </div>
  )
}

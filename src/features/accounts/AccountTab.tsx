import { useEffect, useState } from 'react'
import { CreditCard, TrendingDown, TrendingUp, DollarSign, X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getOrCreateAccount, getAccountMovements, applyPayment, updateCreditLimit } from './accountsService'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import type { Customer, CustomerAccount, AccountMovement } from '@/types/database'

interface AccountTabProps {
  customer: Customer
}

function MovementRow({ m }: { m: AccountMovement }) {
  const isCharge = m.type === 'charge'
  const isPayment = m.type === 'payment'
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition">
      <td className="py-2.5 px-4 text-[12px] text-white/50">
        {new Date(m.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="py-2.5 px-4">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
          isChargeType(m.type)
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : m.type === 'payment'
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          {m.type === 'charge' ? 'Cargo' : m.type === 'payment' ? 'Pago' : 'Ajuste'}
        </span>
      </td>
      <td className="py-2.5 px-4 text-[12px] text-white/60">{m.note ?? '—'}</td>
      <td className={`py-2.5 px-4 text-right text-[13px] font-semibold ${isCharge ? 'text-red-400' : isPayment ? 'text-green-400' : 'text-white'}`}>
        {isCharge ? '+' : isPayment ? '-' : ''}{formatCurrency(m.amount)}
      </td>
    </tr>
  )
}

function isChargeType(type: string) { return type === 'charge' }

interface PaymentModalProps {
  customer: Customer
  account: CustomerAccount
  onClose: () => void
  onDone: () => void
}

function PaymentModal({ customer, account, onClose, onDone }: PaymentModalProps) {
  const { business } = useBusinessStore()
  const { profile } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Ingresá un monto válido'); return }
    if (!business?.id) return
    setLoading(true)
    try {
      await applyPayment(business.id, customer.id, amt, note || undefined, profile?.id)
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-sm rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-white">Registrar pago</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-center py-2">
          <p className="text-[12px] text-white/40">Saldo actual de {customer.name}</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(account.balance)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-white/50 block mb-1">Monto del pago *</label>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError('') }}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-[14px] focus:outline-none focus:border-primary/50 placeholder:text-white/25"
            />
          </div>
          <div>
            <label className="text-[12px] text-white/50 block mb-1">Nota (opcional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej: Pago en efectivo"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-[14px] focus:outline-none focus:border-primary/50 placeholder:text-white/25"
            />
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 glass-btn text-[13px] py-2.5">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 gradient-primary text-white text-[13px] font-semibold py-2.5 rounded-xl hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar pago
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountTab({ customer }: AccountTabProps) {
  const { business } = useBusinessStore()
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [movements, setMovements] = useState<AccountMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [editLimit, setEditLimit] = useState(false)
  const [newLimit, setNewLimit] = useState('')

  const load = async () => {
    if (!business?.id) return
    setLoading(true)
    try {
      const [acc, movs] = await Promise.all([
        getOrCreateAccount(business.id, customer.id),
        getAccountMovements(business.id, customer.id),
      ])
      setAccount(acc)
      setMovements(movs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [customer.id, business?.id])

  const handleSaveLimit = async () => {
    if (!account || !business?.id) return
    const lim = parseFloat(newLimit)
    if (isNaN(lim)) return
    await updateCreditLimit(business.id, customer.id, lim)
    setAccount({ ...account, credit_limit: lim })
    setEditLimit(false)
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />))}
    </div>
  )

  if (!account) return null

  const pctUsed = account.credit_limit > 0 ? (account.balance / account.credit_limit) * 100 : 0
  const overLimit = account.credit_limit > 0 && account.balance > account.credit_limit

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className={`glass-card p-4 border ${overLimit ? 'border-red-500/30 bg-red-500/5' : account.balance > 0 ? 'border-amber-500/20' : 'border-green-500/20'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] text-white/50">Saldo pendiente</p>
            <p className={`text-3xl font-bold mt-1 ${overLimit ? 'text-red-400' : account.balance > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {formatCurrency(account.balance)}
            </p>
            {account.credit_limit > 0 && (
              <p className="text-[11px] text-white/40 mt-1">
                Límite: {formatCurrency(account.credit_limit)}
                {overLimit && <span className="text-red-400 font-medium ml-1">· EXCEDIDO</span>}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditLimit(v => !v)} className="glass-btn text-[12px]">
              {editLimit ? 'Cancelar' : 'Límite'}
            </button>
            {account.balance > 0 && (
              <button onClick={() => setShowPayment(true)} className="gradient-primary text-white text-[12px] font-semibold px-3 py-1.5 rounded-xl hover:brightness-110 transition flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Pago
              </button>
            )}
          </div>
        </div>

        {/* Credit bar */}
        {account.credit_limit > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : pctUsed > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, pctUsed)}%` }}
              />
            </div>
          </div>
        )}

        {/* Edit limit */}
        {editLimit && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              value={newLimit}
              onChange={e => setNewLimit(e.target.value)}
              placeholder={`Límite actual: ${account.credit_limit}`}
              className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-[13px] focus:outline-none focus:border-primary/50"
            />
            <button onClick={handleSaveLimit} className="gradient-primary text-white text-[12px] px-4 rounded-xl hover:brightness-110 transition">
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Movements */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-[13px] font-semibold text-white">Movimientos</p>
        </div>
        {movements.length === 0 ? (
          <p className="text-center py-10 text-[13px] text-white/40">Sin movimientos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 px-4 text-left text-[11px] text-white/30 font-medium uppercase tracking-wide">Fecha</th>
                  <th className="py-2 px-4 text-left text-[11px] text-white/30 font-medium uppercase tracking-wide">Tipo</th>
                  <th className="py-2 px-4 text-left text-[11px] text-white/30 font-medium uppercase tracking-wide">Nota</th>
                  <th className="py-2 px-4 text-right text-[11px] text-white/30 font-medium uppercase tracking-wide">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => <MovementRow key={m.id} m={m} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPayment && account && (
        <PaymentModal
          customer={customer}
          account={account}
          onClose={() => setShowPayment(false)}
          onDone={() => { setShowPayment(false); load() }}
        />
      )}
    </div>
  )
}

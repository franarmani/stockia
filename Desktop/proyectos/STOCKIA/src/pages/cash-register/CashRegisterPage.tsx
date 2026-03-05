import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { CashSession, CashMovement } from '@/types/database'
import {
  Wallet, DoorOpen, DoorClosed, ArrowDownCircle, ArrowUpCircle,
  Clock, TrendingUp, TrendingDown, Banknote, Printer,
  ChevronRight, Plus,
} from 'lucide-react'

export default function CashRegisterPage() {
  const { profile } = useAuthStore()
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [history, setHistory] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [openAmount, setOpenAmount] = useState('')
  const [closeAmount, setCloseAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawReason, setWithdrawReason] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeReason, setIncomeReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (profile?.business_id) fetchAll() }, [profile?.business_id])

  async function fetchAll() {
    setLoading(true)
    const { data: sessions } = await supabase
      .from('cash_sessions').select('*').eq('business_id', profile!.business_id).order('opened_at', { ascending: false })
    const open = sessions?.find(s => s.status === 'open') || null
    setCurrentSession(open)
    setHistory(sessions?.filter(s => s.status === 'closed') || [])
    if (open) {
      const { data: movs } = await supabase
        .from('cash_movements').select('*').eq('session_id', open.id).order('created_at', { ascending: false })
      setMovements(movs || [])
    } else { setMovements([]) }
    setLoading(false)
  }

  async function handleOpen() {
    if (!openAmount) { toast.error('Ingresá el monto inicial'); return }
    setSaving(true)
    const { error } = await supabase.from('cash_sessions').insert({
      business_id: profile!.business_id, opened_by: profile!.id,
      opening_amount: Number(openAmount), status: 'open',
    })
    if (error) toast.error('Error al abrir caja'); else toast.success('Caja abierta')
    setSaving(false); setShowOpenModal(false); setOpenAmount(''); fetchAll()
  }

  async function handleClose() {
    if (!closeAmount || !currentSession) return
    setSaving(true)
    const { error } = await supabase.from('cash_sessions').update({
      closing_amount: Number(closeAmount), closed_by: profile!.id,
      closed_at: new Date().toISOString(), status: 'closed',
    }).eq('id', currentSession.id)
    if (error) toast.error('Error al cerrar caja'); else toast.success('Caja cerrada')
    setSaving(false); setShowCloseModal(false); setCloseAmount(''); fetchAll()
  }

  async function handleWithdraw() {
    if (!withdrawAmount || !currentSession) return
    setSaving(true)
    const { error } = await supabase.from('cash_movements').insert({
      session_id: currentSession.id, type: 'withdrawal',
      amount: Number(withdrawAmount), description: withdrawReason || 'Retiro',
    })
    if (error) toast.error('Error'); else toast.success('Retiro registrado')
    setSaving(false); setShowWithdrawModal(false); setWithdrawAmount(''); setWithdrawReason(''); fetchAll()
  }

  async function handleIncome() {
    if (!incomeAmount || !currentSession) return
    setSaving(true)
    const { error } = await supabase.from('cash_movements').insert({
      session_id: currentSession.id, type: 'income',
      amount: Number(incomeAmount), description: incomeReason || 'Ingreso',
    })
    if (error) toast.error('Error'); else toast.success('Ingreso registrado')
    setSaving(false); setShowIncomeModal(false); setIncomeAmount(''); setIncomeReason(''); fetchAll()
  }

  function handlePrintReport() {
    const opening = currentSession?.opening_amount || 0
    const now = new Date().toLocaleString('es-AR')
    const openedAt = currentSession ? new Date(currentSession.opened_at).toLocaleString('es-AR') : ''
    const w = window.open('', '_blank', 'width=320,height=600')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte de Caja</title>
      <style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:16px}
      .sep{border-top:1px dashed #000;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .bold{font-weight:bold}h2{text-align:center;margin:4px 0}
      @media print{@page{size:80mm auto;margin:4mm}}</style></head><body>
      <h2>Reporte de Caja</h2>
      <div class="sep"></div>
      <div class="row"><span>Apertura:</span><span>${openedAt}</span></div>
      <div class="row"><span>Impreso:</span><span>${now}</span></div>
      <div class="sep"></div>
      <div class="row bold"><span>Monto apertura:</span><span>$${opening.toFixed(2)}</span></div>
      <div class="row" style="color:green"><span>Ventas (${movements.filter(m => m.type === 'sale').length}):</span><span>+$${totalSales.toFixed(2)}</span></div>
      <div class="row" style="color:green"><span>Ingresos (${movements.filter(m => m.type === 'income').length}):</span><span>+$${totalIncome.toFixed(2)}</span></div>
      <div class="row" style="color:red"><span>Retiros (${movements.filter(m => m.type === 'withdrawal').length}):</span><span>-$${totalWithdrawals.toFixed(2)}</span></div>
      <div class="sep"></div>
      <div class="row bold"><span>Esperado en caja:</span><span>$${expectedCash.toFixed(2)}</span></div>
      <div class="sep"></div>
      <h2 style="font-size:11px">Detalle de movimientos</h2>
      <div class="sep"></div>
      ${movements.map(m => `<div class="row"><span>${m.type === 'sale' ? 'VTA' : m.type === 'income' ? 'ING' : 'RET'} ${new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span><span>${m.type === 'withdrawal' ? '-' : '+'}$${m.amount.toFixed(2)}</span></div><div style="font-size:10px;color:#666">${m.description || ''}</div>`).join('')}
      <div class="sep"></div>
      <div style="text-align:center;font-size:10px;color:#666;margin-top:8px">STOCKIA - Reporte automático</div>
      </body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 200)
  }

  const totalSales = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
  const totalIncome = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0)
  const totalWithdrawals = movements.filter(m => m.type === 'withdrawal').reduce((s, m) => s + m.amount, 0)
  const expectedCash = (currentSession?.opening_amount || 0) + totalSales + totalIncome - totalWithdrawals

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Caja</h1>
          <p className="text-sm text-muted-foreground">
            {currentSession ? 'Caja abierta' : 'Caja cerrada'}
          </p>
        </div>
        {!currentSession ? (
          <Button onClick={() => setShowOpenModal(true)}>
            <DoorOpen className="w-4 h-4" /> Abrir caja
          </Button>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowIncomeModal(true)}>
              <ArrowUpCircle className="w-4 h-4" /> Ingreso
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWithdrawModal(true)}>
              <ArrowDownCircle className="w-4 h-4" /> Retiro
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintReport}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCloseModal(true)} className="text-red-600 border-red-200 hover:bg-red-50">
              <DoorClosed className="w-4 h-4" /> Cerrar caja
            </Button>
          </div>
        )}
      </div>

      {currentSession ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><Banknote className="w-4 h-4 text-blue-600" /></div>
                <span className="text-xs text-muted-foreground font-medium">Apertura</span>
              </div>
              <p className="text-base font-bold">{formatCurrency(currentSession.opening_amount)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
                <span className="text-xs text-muted-foreground font-medium">Ventas</span>
              </div>
              <p className="text-base font-bold text-green-600">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center"><Plus className="w-4 h-4 text-sky-600" /></div>
                <span className="text-xs text-muted-foreground font-medium">Ingresos</span>
              </div>
              <p className="text-base font-bold text-sky-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-600" /></div>
                <span className="text-xs text-muted-foreground font-medium">Retiros</span>
              </div>
              <p className="text-base font-bold text-red-600">{formatCurrency(totalWithdrawals)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"><Wallet className="w-4 h-4 text-green-600" /></div>
                <span className="text-xs text-muted-foreground font-medium">Esperado</span>
              </div>
              <p className="text-base font-bold text-green-600">{formatCurrency(expectedCash)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm">
            <div className="p-5 pb-3">
              <h2 className="font-semibold text-foreground">Movimientos del turno</h2>
            </div>
            {movements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-15" />
                <p className="text-sm">Sin movimientos aún</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((m) => {
                  const isPositive = m.type === 'sale' || m.type === 'income'
                  const bgColor = m.type === 'sale' ? 'bg-green-50' : m.type === 'income' ? 'bg-sky-50' : 'bg-red-50'
                  const textColor = m.type === 'sale' ? 'text-green-600' : m.type === 'income' ? 'text-sky-600' : 'text-red-600'
                  const MIcon = m.type === 'sale' ? TrendingUp : m.type === 'income' ? ArrowUpCircle : TrendingDown
                  const label = m.description || (m.type === 'sale' ? 'Venta' : m.type === 'income' ? 'Ingreso' : 'Retiro')
                  return (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
                          <MIcon className={`w-4 h-4 ${textColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{label}</p>
                          <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${textColor}`}>
                        {isPositive ? '+' : '-'}{formatCurrency(m.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <h2 className="text-base font-bold text-foreground mb-1">Caja cerrada</h2>
            <p className="text-[13px] text-muted-foreground mb-4">Abrí la caja para empezar a registrar movimientos</p>
            <Button onClick={() => setShowOpenModal(true)}>
              <DoorOpen className="w-4 h-4" /> Abrir caja
            </Button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-5 pb-3">
                <h2 className="font-semibold text-foreground">Cierres anteriores</h2>
              </div>
              <div className="divide-y divide-border">
                {history.slice(0, 10).map((s) => {
                  const diff = s.closing_amount !== null && s.opening_amount !== null
                    ? s.closing_amount - s.opening_amount : null
                  return (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {new Date(s.opened_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.opened_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {s.closed_at && ` — ${new Date(s.closed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold">{s.closing_amount !== null ? formatCurrency(s.closing_amount) : '-'}</p>
                          {diff !== null && (
                            <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Open Modal */}
      <Modal open={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir caja" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Monto inicial en caja</label>
            <input type="number" value={openAmount} onChange={(e) => setOpenAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowOpenModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleOpen} disabled={saving}>{saving ? 'Abriendo...' : 'Abrir caja'}</Button>
          </div>
        </div>
      </Modal>

      {/* Close Modal */}
      <Modal open={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar caja" size="sm">
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-0.5">Monto esperado en caja</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(expectedCash)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monto real contado</label>
            <input type="number" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {closeAmount && (
            <div className={`text-center text-sm font-medium rounded-lg p-2 ${
              Number(closeAmount) - expectedCash >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              Diferencia: {Number(closeAmount) - expectedCash >= 0 ? '+' : ''}{formatCurrency(Number(closeAmount) - expectedCash)}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleClose} disabled={saving}>{saving ? 'Cerrando...' : 'Cerrar caja'}</Button>
          </div>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal open={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} title="Registrar retiro" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Monto</label>
            <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Motivo</label>
            <input type="text" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="Ej: Pago a proveedor"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowWithdrawModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleWithdraw} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Income Modal */}
      <Modal open={showIncomeModal} onClose={() => setShowIncomeModal(false)} title="Registrar ingreso" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Monto</label>
            <input type="number" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input type="text" value={incomeReason} onChange={(e) => setIncomeReason(e.target.value)} placeholder="Ej: Cobro de deuda, cambio"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowIncomeModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleIncome} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

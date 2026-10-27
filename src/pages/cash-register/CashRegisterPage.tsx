import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { withSyncNote } from '@/sync/connectivity'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { GlassButton } from '@/components/ui/GlassCard'
import type { CashSession, CashMovement } from '@/types/database'
import SessionProductsPanel from '@/features/cash/SessionProductsPanel'
import { loadSessionProducts } from '@/features/cash/sessionProducts'
import {
  Wallet, DoorOpen, DoorClosed, ArrowDownCircle, ArrowUpCircle,
  Clock, TrendingUp, TrendingDown, Banknote, Printer,
  ChevronRight, Plus, CalendarDays
} from 'lucide-react'

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

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
  const { business, updateBusiness } = useBusinessStore()
  const autoCloseTime = ((business as any)?.cash_auto_close_time as string | null) ?? null

  async function saveAutoClose(time: string | null) {
    try {
      await updateBusiness({ cash_auto_close_time: time } as any)
      toast.success(time ? `La caja se va a cerrar sola a las ${time}` : 'Cierre automático desactivado')
    } catch {
      toast.error('No se pudo guardar (hace falta internet)')
    }
  }
  type SessionDetail = Awaited<ReturnType<typeof loadSessionProducts>>
  const [currentDetail, setCurrentDetail] = useState<SessionDetail | null>(null)
  const [historyDetail, setHistoryDetail] = useState<{ session: CashSession; detail: SessionDetail | null } | null>(null)

  useEffect(() => {
    if (!currentSession || !profile?.business_id) { setCurrentDetail(null); return }
    loadSessionProducts(profile.business_id, currentSession.id, currentSession.opened_at, null).then(setCurrentDetail)
  }, [currentSession?.id, movements.length])

  async function openHistoryDetail(session: CashSession) {
    setHistoryDetail({ session, detail: null })
    const detail = await loadSessionProducts(profile!.business_id, session.id, session.opened_at, session.closed_at ?? null)
    setHistoryDetail({ session, detail })
  }

  useEffect(() => { 
    if (profile?.business_id) {
      fetchAll() 
    } else {
      // If profile is loaded but no business_id, stop loading
      const timeout = setTimeout(() => {
        if (!profile?.business_id) setLoading(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [profile?.business_id])

  // Al terminar de sincronizar, recargar con los datos del servidor
  useEffect(() => {
    if (!profile?.business_id) return
    return syncEngine.onSynced(() => { fetchAll() })
  }, [profile?.business_id])

  async function fetchAll() {
    try {
      setLoading(true)
      const businessId = profile!.business_id
      const sessions = (await syncEngine.pullRows<CashSession>('cash_sessions', businessId, () =>
        supabase.from('cash_sessions').select('*').eq('business_id', businessId).order('opened_at', { ascending: false })
      )).sort((a, b) => b.opened_at.localeCompare(a.opened_at))

      const open = sessions.find(s => s.status === 'open') || null
      setCurrentSession(open)
      setHistory(sessions.filter(s => s.status === 'closed'))

      const movs = await syncEngine.pullRows<CashMovement>('cash_movements', businessId, () =>
        open
          ? supabase.from('cash_movements').select('*').eq('session_id', open.id)
          : Promise.resolve({ data: [], error: null })
      )
      setMovements(open
        ? movs.filter(m => m.session_id === open.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
        : [])
    } catch (error) {
      console.error('[CashRegister] Error fetching data:', error)
      toast.error('Error al cargar datos de caja')
    } finally {
      setLoading(false)
    }
  }

  // Cada operación se guarda primero en este equipo y se envía al servidor en segundo plano.
  async function runLocal(work: () => Promise<void>, successMessage: string) {
    setSaving(true)
    try {
      await work()
      toast.success(withSyncNote(successMessage))
    } catch (error) {
      console.error('[CashRegister] local write failed:', error)
      toast.error('No se pudo guardar en la base local')
    } finally {
      setSaving(false)
      fetchAll()
    }
  }

  async function handleOpen() {
    if (!openAmount) { toast.error('Ingresá el monto inicial'); return }
    await runLocal(() => syncEngine.createRow('cash_sessions', profile!.business_id, {
      id: crypto.randomUUID(),
      opened_by: profile!.id,
      opening_amount: Number(openAmount),
      status: 'open',
      opened_at: new Date().toISOString(),
    }), 'Caja abierta')
    setShowOpenModal(false); setOpenAmount('')
  }

  async function handleClose() {
    if (!closeAmount || !currentSession) return
    await runLocal(() => syncEngine.updateRow('cash_sessions', profile!.business_id, currentSession.id, {
      closing_amount: Number(closeAmount), closed_by: profile!.id,
      closed_at: new Date().toISOString(), status: 'closed',
    }), 'Caja cerrada')
    setShowCloseModal(false); setCloseAmount('')
  }

  async function handleWithdraw() {
    if (!withdrawAmount || !currentSession) return
    await runLocal(() => syncEngine.createRow('cash_movements', profile!.business_id, {
      id: crypto.randomUUID(),
      session_id: currentSession.id, type: 'withdrawal',
      amount: Number(withdrawAmount), description: withdrawReason || 'Retiro',
      created_at: new Date().toISOString(),
    }), 'Retiro registrado')
    setShowWithdrawModal(false); setWithdrawAmount(''); setWithdrawReason('')
  }

  async function handleIncome() {
    if (!incomeAmount || !currentSession) return
    await runLocal(() => syncEngine.createRow('cash_movements', profile!.business_id, {
      id: crypto.randomUUID(),
      session_id: currentSession.id, type: 'income',
      amount: Number(incomeAmount), description: incomeReason || 'Ingreso',
      created_at: new Date().toISOString(),
    }), 'Ingreso registrado')
    setShowIncomeModal(false); setIncomeAmount(''); setIncomeReason('')
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
      ${currentDetail?.sold.length ? `<h2 style="font-size:11px">Productos vendidos</h2><div class="sep"></div>
      ${currentDetail.sold.map(p => `<div class="row"><span>${escapeHtml(p.name)} x${p.quantity}</span><span>$${p.total.toFixed(2)}</span></div>`).join('')}
      <div class="sep"></div>` : ''}
      ${currentDetail?.consumption.length ? `<h2 style="font-size:11px">Consumo de empleados</h2><div class="sep"></div>
      ${currentDetail.consumption.map(c => `<div class="row"><span>${escapeHtml(c.name)} x${c.quantity}</span><span>$${c.cost.toFixed(2)}</span></div><div style="font-size:10px;color:#666">${escapeHtml(c.employee)}</div>`).join('')}
      <div class="sep"></div>` : ''}
      <div style="text-align:center;font-size:10px;color:#666;margin-top:8px">CajaGo - Reporte automático</div>
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
    <div className="animate-fade-in flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-black">Operaciones</p>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)] mt-1">Caja</h1>
          <div className="flex items-center gap-2 mt-1">
             <div className={cn("w-1.5 h-1.5 rounded-full", currentSession ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
             <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">
               {currentSession ? 'Sesión Activa' : 'Caja Cerrada'}
             </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:justify-end">
          {!currentSession ? (
            <GlassButton onClick={() => setShowOpenModal(true)} className="bg-emerald-500 text-white hover:bg-emerald-400 border-none font-black shadow-lg shadow-emerald-500/20 px-6">
              <DoorOpen className="w-4 h-4" /> Abrir Caja
            </GlassButton>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <GlassButton size="sm" onClick={() => setShowIncomeModal(true)} className="bg-white/5">
                <ArrowUpCircle className="w-3.5 h-3.5" /> Ingreso
              </GlassButton>
              <GlassButton size="sm" onClick={() => setShowWithdrawModal(true)} className="bg-white/5">
                <ArrowDownCircle className="w-3.5 h-3.5" /> Retiro
              </GlassButton>
              <GlassButton size="sm" onClick={handlePrintReport} className="bg-white/5">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </GlassButton>
              <GlassButton size="sm" onClick={() => setShowCloseModal(true)} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border-red-500/20">
                <DoorClosed className="w-3.5 h-3.5" /> Cerrar Caja
              </GlassButton>
            </div>
          )}
        </div>
      </div>

      {profile?.role === 'admin' && (
        <div className="mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <Clock className="w-4 h-4 text-white/40" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold text-white">Cierre automático</p>
            <p className="text-xs text-white/40">
              {autoCloseTime
                ? `Todos los días a las ${autoCloseTime} la caja se cierra sola con el monto esperado (sin recuento).`
                : 'Si te olvidás de cerrar la caja, el programa la cierra solo a la hora que elijas.'}
            </p>
          </div>
          <input
            type="time"
            key={autoCloseTime ?? 'none'}
            defaultValue={autoCloseTime ?? ''}
            onBlur={(e) => { if (e.target.value && e.target.value !== autoCloseTime) saveAutoClose(e.target.value) }}
            className="h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm [color-scheme:dark]"
          />
          {autoCloseTime && (
            <button onClick={() => saveAutoClose(null)} className="h-9 px-3 rounded-lg bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10">
              Desactivar
            </button>
          )}
        </div>
      )}

      {currentSession ? (
        <div className="space-y-6">
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
            <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                  <Banknote className="w-16 h-16 text-blue-400" />
               </div>
               <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black mb-1">Apertura</p>
               <p className="text-xl font-black text-white">{formatCurrency(currentSession.opening_amount)}</p>
            </div>

            <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-3xl p-5 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-16 h-16 text-emerald-400" />
               </div>
               <p className="text-[10px] text-emerald-500/50 uppercase tracking-[0.2em] font-black mb-1">Ventas</p>
               <p className="text-xl font-black text-emerald-400">{formatCurrency(totalSales)}</p>
            </div>

            <div className="bg-sky-500/[0.03] border border-sky-500/10 rounded-3xl p-5 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Plus className="w-16 h-16 text-sky-400" />
               </div>
               <p className="text-[10px] text-sky-500/50 uppercase tracking-[0.2em] font-black mb-1">Ingresos</p>
               <p className="text-xl font-black text-sky-400">{formatCurrency(totalIncome)}</p>
            </div>

            <div className="bg-red-500/[0.03] border border-red-500/10 rounded-3xl p-5 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingDown className="w-16 h-16 text-red-400" />
               </div>
               <p className="text-[10px] text-red-500/50 uppercase tracking-[0.2em] font-black mb-1">Retiros</p>
               <p className="text-xl font-black text-red-400">{formatCurrency(totalWithdrawals)}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 col-span-2 lg:col-span-1 relative overflow-hidden group shadow-xl shadow-emerald-500/5 ring-1 ring-white/10">
               <div className="absolute -right-4 -top-4 opacity-20 group-hover:scale-110 transition-transform">
                  <Wallet className="w-16 h-16 text-white" />
               </div>
               <p className="text-[10px] text-white uppercase tracking-[0.2em] font-black mb-1">Esperado</p>
               <p className="text-xl font-black text-white">{formatCurrency(expectedCash)}</p>
               <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">En Tiempo Real</p>
               </div>
            </div>
          </div>

          {/* Movement List */}
          <div className="px-1">
            <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden">
              <div className="p-6 pb-2">
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Movimientos del turno</p>
              </div>
              
              {movements.length === 0 ? (
                <div className="text-center py-20">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-white/5" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs">Sin actividad registrada</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {movements.map((m) => {
                    const isPositive = m.type === 'sale' || m.type === 'income'
                    const bgColor = m.type === 'sale' ? 'bg-emerald-500/10' : m.type === 'income' ? 'bg-sky-500/10' : 'bg-red-500/10'
                    const textColor = m.type === 'sale' ? 'text-emerald-400' : m.type === 'income' ? 'text-sky-400' : 'text-red-400'
                    const MIcon = m.type === 'sale' ? TrendingUp : m.type === 'income' ? ArrowUpCircle : TrendingDown
                    const label = m.description || (m.type === 'sale' ? 'Venta' : m.type === 'income' ? 'Ingreso' : 'Retiro')
                    
                    return (
                      <div key={m.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/5", bgColor)}>
                            <MIcon className={cn("w-5 h-5", textColor)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white tracking-tight group-hover:text-primary transition-colors">{label}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                               <Clock className="w-3 h-3 text-white/20" />
                               <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                 {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                               </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-base font-black tracking-tight", textColor)}>
                            {isPositive ? '+' : '-'}{formatCurrency(m.amount)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {currentDetail && (
            <div className="px-1">
              <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6">
                <SessionProductsPanel sold={currentDetail.sold} consumption={currentDetail.consumption} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#10141b] border border-white/[0.07] rounded-2xl p-10 text-center relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
               <Wallet className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-2">La caja está cerrada</h2>
            <p className="text-sm text-white/40 mb-8 max-w-xs mx-auto">Para comenzar a operar y registrar ventas, iniciá una nueva sesión de caja.</p>
            <GlassButton onClick={() => setShowOpenModal(true)} size="lg" className="bg-emerald-500 text-white hover:bg-emerald-400 border-none font-black shadow-xl shadow-emerald-500/20 px-10">
              <DoorOpen className="w-5 h-5" /> Abrir Caja
            </GlassButton>
          </div>

          {/* History - Bento Style Grid */}
          {history.length > 0 && (
            <div className="px-1 space-y-4">
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] ml-2">Cierres Recientes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.slice(0, 9).map((s) => {
                  const diff = s.closing_amount !== null && s.opening_amount !== null
                    ? s.closing_amount - s.opening_amount : null
                  return (
                    <div 
                      key={s.id} 
                      className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/5 transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/30 group-hover:text-white transition-colors">
                           <CalendarDays className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-white">
                             {new Date(s.opened_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                           </p>
                           <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">
                             {new Date(s.opened_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                           </p>
                        </div>
                      </div>

                      <div className="space-y-2 bg-black/20 rounded-2xl p-4 border border-white/5">
                        <div className="flex items-center justify-between">
                           <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Saldo Cierre</p>
                           <p className="text-sm font-black text-white">{s.closing_amount !== null ? formatCurrency(s.closing_amount) : '-'}</p>
                        </div>
                        {diff !== null && (
                          <div className="flex items-center justify-between">
                             <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Balance</p>
                             <p className={cn("text-xs font-black tracking-tight", diff >= 0 ? "text-emerald-400" : "text-red-400")}>
                               {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                             </p>
                          </div>
                        )}
                      </div>

                      <button onClick={() => openHistoryDetail(s)} className="mt-4 w-full h-9 rounded-xl border border-white/5 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-white group-hover:bg-white/5 transition-all">
                         Ver Detalles
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Open Modal */}
      <Modal open={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir caja" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Monto inicial en caja</label>
            <input type="number" value={openAmount} onChange={(e) => setOpenAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-white/10 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
              className="w-full h-10 px-4 rounded-lg border border-white/10 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
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

      <Modal
        open={!!historyDetail}
        onClose={() => setHistoryDetail(null)}
        title={historyDetail ? `Caja del ${new Date(historyDetail.session.opened_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
        size="lg"
      >
        {historyDetail?.detail
          ? <SessionProductsPanel sold={historyDetail.detail.sold} consumption={historyDetail.detail.consumption} />
          : <div className="h-32 grid place-items-center"><div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}
      </Modal>

      {/* Withdraw Modal */}
      <Modal open={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} title="Registrar retiro" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Monto</label>
            <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0"
              className="w-full h-10 px-4 rounded-lg border border-white/10 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Motivo</label>
            <input type="text" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="Ej: Pago a proveedor"
              className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
              className="w-full h-10 px-4 rounded-lg border border-white/10 bg-white text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input type="text" value={incomeReason} onChange={(e) => setIncomeReason(e.target.value)} placeholder="Ej: Cobro de deuda, cambio"
              className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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

import { useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncEngine } from '@/sync/syncEngine'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { rememberOfflineCredential } from '@/desktop/offlineAuth'
import type { StockConflict, SyncOperation } from '@/sync/types'
import { Wifi, WifiOff, RefreshCw, AlertTriangle, X, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'

const OPERATION_LABELS: Record<string, string> = {
  CREATE_SALE: 'Venta',
  UPDATE_STOCK: 'Ajuste de stock',
  CUSTOMER_PAYMENT: 'Cobro a cliente',
  UPSERT_ROW: 'Alta',
  UPDATE_ROW: 'Modificación',
  DELETE_ROW: 'Eliminación',
}

const TABLE_LABELS: Record<string, string> = {
  products: 'producto',
  customers: 'cliente',
  categories: 'categoría',
  suppliers: 'proveedor',
  cash_sessions: 'caja',
  cash_movements: 'movimiento de caja',
  purchase_concepts: 'concepto de compra',
  accounting_accounts: 'cuenta contable',
  promotions: 'promoción',
}

function describe(op: SyncOperation): string {
  if (op.operation_type === 'RPC_CALL') return (op.payload as { label?: string }).label || 'Operación del servidor'
  const label = OPERATION_LABELS[op.operation_type] || op.operation_type
  const table = (op.payload as { table?: string }).table
  return table ? `${label} de ${TABLE_LABELS[table] || table}` : label
}

export default function OfflineIndicator() {
  const { isOnline, pendingCount, failedCount, conflictCount, needsLogin, syncing, syncNow } = useOnlineStatus()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [reauthing, setReauthing] = useState(false)
  const [failedOps, setFailedOps] = useState<SyncOperation[]>([])
  const [conflicts, setConflicts] = useState<StockConflict[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  async function loadDetails() {
    setFailedOps(await syncEngine.getFailedOperations())
    setConflicts(await syncEngine.getStockConflicts())
  }

  useEffect(() => {
    if (open) loadDetails()
  }, [open, failedCount, conflictCount])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function discard(op: SyncOperation) {
    if (!confirm(`¿Descartar "${describe(op)}"? El cambio local se pierde y se restaura lo que hay en el servidor.`)) return
    try {
      await syncEngine.discardOperation(op.operation_id)
      toast.success('Operación descartada')
      loadDetails()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo descartar')
    }
  }

  // Se ingresó sin conexión: para enviar lo pendiente hace falta una sesión real del servidor.
  async function reauthenticate(event: React.FormEvent) {
    event.preventDefault()
    if (!user?.email || !password) return
    setReauthing(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: user.email, password })
    setReauthing(false)
    if (error || !data.user) {
      toast.error('Contraseña incorrecta')
      return
    }
    rememberOfflineCredential(user.email, password, data.user.id).catch(() => {})
    setPassword('')
    syncNow()
  }

  async function markReviewed(conflict: StockConflict) {
    await syncEngine.resolveStockConflict(conflict.conflict_id)
    loadDetails()
  }

  let chip: React.ReactElement
  if (syncing) {
    chip = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-mono font-medium">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span className="hidden sm:inline">SINCRONIZANDO</span>
      </span>
    )
  } else if (!isOnline) {
    chip = (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium"
        title="Sin conexión con el servidor. Todo se guarda localmente y se sincroniza al volver."
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <WifiOff className="w-3 h-3" />
        <span className="hidden sm:inline">SIN CONEXIÓN</span>
        {pendingCount > 0 && (
          <span className="bg-amber-500/25 px-1.5 rounded font-bold text-amber-200 text-[10px]">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </span>
    )
  } else if (needsLogin || failedCount > 0 || conflictCount > 0) {
    chip = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-mono font-medium">
        <AlertTriangle className="w-3 h-3" />
        <span>{needsLogin ? 'Reingresá para sincronizar' : `${failedCount + conflictCount} para revisar`}</span>
      </span>
    )
  } else if (pendingCount > 0) {
    chip = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium">
        <RefreshCw className="w-3 h-3" />
        <span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
      </span>
    )
  } else {
    chip = (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium"
        title="En línea · Base local sincronizada"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <Wifi className="w-3 h-3" />
        <span className="hidden sm:inline">ONLINE</span>
      </span>
    )
  }

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button onClick={() => setOpen((value) => !value)} className="flex" aria-label="Estado de sincronización">
        {chip}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] z-50 rounded-xl border border-white/10 bg-[#0b1626] shadow-2xl p-3 text-xs text-white/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Sincronización</span>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p>
            {isOnline
              ? 'Conectado al servidor.'
              : 'Sin conexión con el servidor. Ventas, caja, stock, clientes, compras y asientos se guardan en este equipo y se envían solos al volver la conexión. La facturación electrónica ARCA queda pendiente hasta entonces.'}
          </p>
          <p className="text-white/60">
            {pendingCount} operación(es) pendiente(s) · {failedCount} con error · {conflictCount} conflicto(s) de stock
          </p>

          {isOnline && needsLogin && (
            <form onSubmit={reauthenticate} className="space-y-1.5 rounded-lg bg-white/[0.04] border border-white/10 p-2">
              <p>Volvió la conexión. Ingresá tu contraseña para enviar lo que se guardó sin conexión.</p>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                className="w-full rounded-md bg-black/30 border border-white/10 px-2 py-1.5 text-white outline-none focus:border-primary/50"
              />
              <button
                type="submit"
                disabled={reauthing || !password}
                className="w-full py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25 disabled:opacity-50"
              >
                {reauthing ? 'Ingresando...' : 'Ingresar y sincronizar'}
              </button>
            </form>
          )}

          {isOnline && !needsLogin && (pendingCount > 0 || failedCount > 0) && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar ahora
            </button>
          )}

          {failedOps.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-semibold text-red-300">Con error</p>
              {failedOps.map((op) => (
                <div key={op.operation_id} className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{describe(op)}</span>
                    {op.operation_type !== 'CREATE_SALE' && (
                      <button onClick={() => discard(op)} className="text-red-300 hover:text-red-200" title="Descartar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-red-200/80 break-words">{op.last_error || 'Error desconocido'}</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(op.created_at).toLocaleString('es-AR')} · {op.retry_count} intento(s)
                  </p>
                </div>
              ))}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-semibold text-amber-300">Stock vendido de más mientras no había conexión</p>
              {conflicts.map((conflict) => (
                <div key={conflict.conflict_id} className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{conflict.product_name}</p>
                    <p className="text-[11px] text-amber-200/80">
                      Se vendieron {conflict.requested_qty} con {conflict.server_qty} en stock. Revisá el inventario.
                    </p>
                  </div>
                  <button onClick={() => markReviewed(conflict)} className="text-amber-300 hover:text-amber-200 shrink-0" title="Marcar como revisado">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

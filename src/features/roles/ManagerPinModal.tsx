import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isOnline } from '@/sync/connectivity'
import Modal from '@/components/ui/Modal'
import { useManagerApproval } from './managerApproval'

/** Pide el código de encargado (se verifica en el servidor). Montado una vez en la app. */
export default function ManagerPinModal() {
  const { reason, finish } = useManagerApproval()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => { setPin(''); setError('') }, [reason])

  async function check() {
    if (!pin) return
    if (!isOnline()) { setError('Sin internet no se puede verificar el código. Pedile a un encargado que lo haga.'); return }
    setChecking(true)
    setError('')
    const { data, error: rpcError } = await (supabase as any).rpc('verify_manager_pin', { p_pin: pin })
    setChecking(false)
    if (rpcError) { setError(rpcError.message); return }
    if (data === true) finish(pin)
    else { setError('Código incorrecto'); setPin('') }
  }

  return (
    <Modal open={!!reason} onClose={() => finish(null)} title="Código de encargado" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-white/70">{reason}: necesitás que un encargado ingrese su código.</p>
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={(e) => { if (e.key === 'Enter') check() }}
          placeholder="••••"
          className="w-full h-12 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-center text-xl tracking-[0.5em] focus:outline-none focus:border-primary/40"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button onClick={check} disabled={checking || !pin} className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
          {checking ? 'Verificando...' : 'Autorizar'}
        </button>
      </div>
    </Modal>
  )
}

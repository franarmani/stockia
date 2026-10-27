import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** El administrador define el código que autoriza anulaciones y quitar productos al Vendedor Jr. */
export default function ManagerPinCard() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(supabase as any).rpc('has_manager_pin').then(({ data }: any) => setHasPin(data === true), () => setHasPin(false))
  }, [])

  async function save(value: string | null) {
    if (value !== null && !/^\d{4,8}$/.test(value)) { toast.error('El código tiene que tener de 4 a 8 números'); return }
    setSaving(true)
    const { error } = await (supabase as any).rpc('set_manager_pin', { p_pin: value })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setHasPin(value !== null)
    setPin('')
    toast.success(value ? 'Código de encargado guardado' : 'Código de encargado eliminado')
  }

  return (
    <div className="border-t border-white/5 p-5 flex flex-wrap items-center gap-3">
      <KeyRound className="w-4 h-4 text-white/40" />
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-semibold text-white">Código de encargado</p>
        <p className="text-xs text-white/40">
          {hasPin ? 'Configurado. ' : 'Sin configurar. '}
          Lo piden los vendedores para anular ventas, y el Vendedor Jr para quitar productos de la venta.
        </p>
      </div>
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        placeholder={hasPin ? 'Nuevo código' : '4 a 8 números'}
        className="h-9 w-36 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40"
      />
      <button onClick={() => save(pin)} disabled={saving || !pin} className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 disabled:opacity-50">
        Guardar
      </button>
      {hasPin && (
        <button onClick={() => save(null)} disabled={saving} className="h-9 px-3 rounded-lg bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10">
          Quitar
        </button>
      )}
    </div>
  )
}

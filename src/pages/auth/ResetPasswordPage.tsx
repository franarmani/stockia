import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CajaGoBrand from '@/components/brand/CajaGoBrand'

// Destino del link "Olvidé mi contraseña": Supabase abre una sesión de recuperación con el
// token del link y acá se elige la contraseña nueva.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) setReady('ok')
    })
    // El token del link puede procesarse antes de suscribirse: se revisa la sesión igual.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady('ok')
      else setTimeout(() => setReady(current => (current === 'checking' ? 'invalid' : current)), 2500)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    setDone(true)
  }

  const input = 'w-full h-12 pl-11 pr-11 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-[#7087f5]/60'

  return (
    <div className="min-h-screen bg-[#090c11] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121923] p-7">
        <div className="flex justify-center mb-6"><CajaGoBrand size="sm" /></div>

        {done ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h1 className="mt-4 text-xl font-bold text-white">Contraseña actualizada</h1>
            <p className="mt-2 text-sm text-slate-400">Ya podés ingresar con tu contraseña nueva, en la web o en el programa CajaGo.</p>
            <Link to="/menu" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#7087f5] px-6 text-sm font-bold text-white hover:bg-[#8498fb]">Ir a CajaGo</Link>
          </div>
        ) : ready === 'checking' ? (
          <div className="py-10 grid place-items-center"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
        ) : ready === 'invalid' ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">El link no es válido o venció</h1>
            <p className="mt-2 text-sm text-slate-400">Pedí uno nuevo desde "Olvidé mi contraseña". Los links duran una hora y sirven una sola vez.</p>
            <Link to="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10">Volver a ingresar</Link>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">Elegí tu contraseña nueva</h1>
              <p className="mt-1 text-sm text-slate-400">Mínimo 8 caracteres.</p>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña nueva" className={input} />
              <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-3 w-6 h-6 grid place-items-center text-slate-500" aria-label={show ? 'Ocultar' : 'Mostrar'}>
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetila" className={input} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={saving} className="w-full h-12 rounded-xl bg-[#7087f5] text-white text-sm font-bold hover:bg-[#8498fb] disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar contraseña
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

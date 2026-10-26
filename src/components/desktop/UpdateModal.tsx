import { useState, useEffect } from 'react'
import { initPeriodicUpdater, installAppUpdate, type UpdateInfo } from '@/desktop/updater'
import { Download, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react'

export default function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return initPeriodicUpdater((info) => {
      setUpdateInfo(info)
      setIsOpen(true)
    })
  }, [])

  if (!isOpen || !updateInfo) return null

  const handleUpdate = async () => {
    setInstalling(true)
    setError(null)
    try {
      await installAppUpdate((pct) => setProgress(pct))
    } catch (err: any) {
      console.error('Update install failed:', err)
      setError(err?.message || 'Error al descargar o validar la actualización firmada.')
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#10141c] border border-white/[0.09] rounded-[1.25rem] p-6 sm:p-7 max-w-md w-full shadow-[0_30px_90px_rgba(2,5,12,0.6)] text-white relative">
        {!updateInfo.isMandatory && !installing && (
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-[10px] bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nueva versión disponible</h3>
            <p className="text-xs text-slate-400">Actualización oficial firmada de CajaGo</p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-[10px] p-3.5 mb-4 text-[13px] tabular-nums space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Versión instalada:</span>
            <span className="text-slate-300 font-bold">{updateInfo.currentVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nueva versión:</span>
            <span className="text-emerald-400 font-bold">{updateInfo.version}</span>
          </div>
          {updateInfo.isMandatory && (
            <div className="pt-1.5 border-t border-white/[0.06] flex items-center gap-1.5 text-amber-300 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Actualización obligatoria para continuar operando</span>
            </div>
          )}
        </div>

        {updateInfo.body && (
          <div className="mb-5 max-h-32 overflow-y-auto text-[13px] text-slate-300 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg leading-relaxed">
            <p className="text-[12px] text-slate-400 font-semibold mb-1">Novedades</p>
            <div className="whitespace-pre-line">{updateInfo.body}</div>
          </div>
        )}

        {installing ? (
          <div className="space-y-2 mb-2">
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-primary flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Descargando y verificando firma...</span>
              </span>
              <span className="text-white font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center pt-1">
              CajaGo se reiniciará automáticamente al finalizar.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 pt-2">
            {!updateInfo.isMandatory && (
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Más tarde
              </button>
            )}
            <button
              onClick={handleUpdate}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6178ee] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#6f8cff] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Actualizar ahora</span>
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 mt-3 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}

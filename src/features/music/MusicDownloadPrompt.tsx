import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/usePlan'
import { useBusinessStore } from '@/stores/businessStore'
import { isOnline } from '@/sync/connectivity'
import { downloadMusic, MUSIC_DOWNLOAD_MB, shouldOfferMusicDownload, snoozeMusicDownload } from './musicDownload'

/** Al abrir el programa ofrece bajar CajaGo Music para que suene sin internet (si el plan la incluye). */
export default function MusicDownloadPrompt() {
  const { hasFeature } = usePlan()
  const { business } = useBusinessStore()
  const allowed = !!business && hasFeature('music')
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!allowed || !shouldOfferMusicDownload() || !isOnline()) return
    const timer = setTimeout(() => setOpen(true), 4000)
    return () => clearTimeout(timer)
  }, [allowed])

  async function start() {
    setProgress({ done: 0, total: 1 })
    try {
      await downloadMusic((done, total) => setProgress({ done, total }))
      toast.success('CajaGo Music quedó descargada: ya suena aunque no haya internet.')
      setOpen(false)
    } catch (error: any) {
      toast.error(`No se pudo terminar la descarga. Se vuelve a intentar la próxima vez que abras CajaGo. ${error?.message ?? ''}`)
      setProgress(null)
      setOpen(false)
    }
  }

  if (!open) return null
  const downloading = progress !== null
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/[0.09] bg-[#10141c] p-5 text-white shadow-[0_24px_70px_rgba(2,5,12,0.6)] animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6178ee]/15 text-[#9aa9ff]">
          <Music className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Descargar CajaGo Music</p>
          <p className="mt-1 text-[13px] leading-5 text-white/55">
            {downloading
              ? `Descargando canciones… ${progress.done} de ${progress.total}. Podés seguir trabajando.`
              : `30 canciones para el local (${MUSIC_DOWNLOAD_MB} MB). Una vez descargadas, suenan aunque no haya internet.`}
          </p>
        </div>
      </div>

      {downloading ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#6178ee] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => { snoozeMusicDownload(); setOpen(false) }}
            className="h-9 rounded-lg px-3 text-[13px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            Ahora no
          </button>
          <button onClick={start} className="h-9 rounded-lg bg-[#6178ee] px-4 text-[13px] font-semibold text-white hover:bg-[#6f8cff]">
            Descargar
          </button>
        </div>
      )}
    </div>
  )
}

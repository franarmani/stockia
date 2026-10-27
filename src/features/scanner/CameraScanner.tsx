import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CheckCircle2, RefreshCw, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ScanFeedback {
  ok: boolean
  message: string
  detail?: string
  /** Botón extra en el aviso (por ejemplo "Crear producto con este código"). */
  action?: { label: string; run: () => void }
  /** Cierra el escáner después de este resultado (lectura única). */
  close?: boolean
}

const REGION_ID = 'cg-camera-scanner-region'
const SAME_CODE_MS = 1600

let audio: AudioContext | null = null
function beep(ok: boolean) {
  try {
    audio = audio ?? new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = ok ? 1100 : 280
    gain.gain.value = 0.08
    osc.connect(gain); gain.connect(audio.destination)
    osc.start(); osc.stop(audio.currentTime + (ok ? 0.09 : 0.25))
  } catch { /* sin sonido */ }
  try { navigator.vibrate?.(ok ? 50 : [80, 60, 80]) } catch { /* sin vibración */ }
}

type Status = 'starting' | 'running' | 'error'

/**
 * Lector de códigos de barras y QR con la cámara (celular, tablet o computadora). Pantalla completa,
 * prioriza la cámara trasera y NO se cierra después de cada lectura: pensado para ir escaneando productos.
 */
export default function CameraScanner({
  open,
  onClose,
  onScan,
  title = 'Escanear',
  hint = 'Apuntá al código de barras o al QR',
}: {
  open: boolean
  onClose: () => void
  onScan: (code: string) => ScanFeedback | Promise<ScanFeedback>
  title?: string
  hint?: string
}) {
  const [status, setStatus] = useState<Status>('starting')
  const [errorText, setErrorText] = useState('')
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)
  const [flash, setFlash] = useState<'ok' | 'error' | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [cameraIndex, setCameraIndex] = useState(-1)
  const scannerRef = useRef<any>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const busyRef = useRef(false)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  onScanRef.current = onScan
  onCloseRef.current = onClose

  const stop = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try { if (scanner.isScanning) await scanner.stop() } catch { /* ya estaba detenido */ }
    try { scanner.clear() } catch { /* nada que limpiar */ }
  }, [])

  const handleCode = useCallback(async (code: string) => {
    const now = Date.now()
    if (busyRef.current) return
    if (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_MS) return
    lastRef.current = { code, at: now }
    busyRef.current = true
    try {
      const result = await onScanRef.current(code)
      beep(result.ok)
      setFlash(result.ok ? 'ok' : 'error')
      setTimeout(() => setFlash(null), 350)
      setFeedback(result)
      clearTimeout(feedbackTimer.current)
      if (!result.action) feedbackTimer.current = setTimeout(() => setFeedback(null), 2200)
      if (result.close) onCloseRef.current()
    } finally {
      busyRef.current = false
    }
  }, [])

  const start = useCallback(async (preferredId?: string) => {
    setStatus('starting'); setErrorText('')
    await stop()

    if (!window.isSecureContext) {
      setStatus('error'); setErrorText('La cámara solo funciona en una conexión segura (https).'); return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error'); setErrorText('Este navegador o dispositivo no permite usar la cámara.'); return
    }
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const list = await Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[])
      if (list.length === 0) {
        setStatus('error'); setErrorText('No encontramos ninguna cámara en este dispositivo.'); return
      }
      setCameras(list)
      const back = list.findIndex((camera) => /back|rear|trasera|environment|posterior/i.test(camera.label))

      const scanner = new Html5Qrcode(REGION_ID, { verbose: false } as any)
      scannerRef.current = scanner
      const source: any = preferredId ? { deviceId: { exact: preferredId } } : back >= 0 ? { deviceId: { exact: list[back].id } } : { facingMode: 'environment' }
      await scanner.start(
        source,
        // Sin recuadro de lectura: se analiza todo el cuadro (un recorte fijo dejaba afuera a los QR).
        { fps: 12 },
        (decoded: string) => { void handleCode(decoded) },
        () => {},
      )
      setCameraIndex(preferredId ? list.findIndex((camera) => camera.id === preferredId) : back)
      setStatus('running')
    } catch (error: any) {
      const name = String(error?.name ?? error)
      await stop()
      setStatus('error')
      if (/NotAllowed|Permission/i.test(name)) setErrorText('Permiso de cámara denegado. Habilitalo en los permisos del sitio y volvé a intentar.')
      else if (/NotFound|Devices/i.test(name)) setErrorText('No encontramos ninguna cámara en este dispositivo.')
      else if (/NotReadable|TrackStart|Could not start/i.test(name)) setErrorText('La cámara está siendo usada por otra aplicación. Cerrala y probá de nuevo.')
      else setErrorText(`No se pudo abrir la cámara (${error?.message ?? name}).`)
    }
  }, [handleCode, stop])

  useEffect(() => {
    if (!open) return
    setFeedback(null); lastRef.current = { code: '', at: 0 }
    const timer = setTimeout(() => { void start() }, 120)
    // La cámara nunca queda prendida en segundo plano.
    const onHidden = () => { if (document.hidden) onCloseRef.current() }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onHidden)
      clearTimeout(feedbackTimer.current)
      void stop()
    }
  }, [open, start, stop])

  if (!open) return null

  const switchCamera = () => {
    if (cameras.length < 2) return
    const next = (cameraIndex + 1) % cameras.length
    void start(cameras[next].id)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{title}</p>
          <p className="truncate text-xs text-white/60">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && status === 'running' && (
            <button onClick={switchCamera} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:scale-95" aria-label="Cambiar de cámara">
              <RefreshCw className="h-5 w-5" />
            </button>
          )}
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:scale-95" aria-label="Cerrar el escáner">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* El video conserva su proporción: estirarlo deforma lo que analiza el lector. */}
        <div id={REGION_ID} className={cn('flex h-full w-full items-center justify-center overflow-hidden bg-black [&_video]:max-h-full [&_video]:max-w-full', status === 'error' && 'hidden')} />
        {status === 'starting' && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="flex flex-col items-center gap-2"><Camera className="h-8 w-8 animate-pulse" /><p className="text-sm">Abriendo la cámara…</p></div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-white">
            <div className="flex max-w-sm flex-col items-center gap-3">
              <CameraOff className="h-10 w-10 text-white/50" />
              <p className="text-sm text-white/80">{errorText}</p>
              <button onClick={() => void start()} className="h-11 rounded-xl bg-white px-5 text-sm font-bold text-black">Reintentar</button>
            </div>
          </div>
        )}
        {flash && <div className={cn('pointer-events-none absolute inset-0 border-[6px]', flash === 'ok' ? 'border-emerald-400/90 bg-emerald-400/10' : 'border-red-500/90 bg-red-500/10')} />}
      </div>

      <div className="min-h-[7.5rem] bg-neutral-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {feedback ? (
          <div className={cn('flex items-start gap-3 rounded-2xl border p-3', feedback.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10')}>
            {feedback.ok ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-white">{feedback.message}</p>
              {feedback.detail && <p className="text-xs text-white/60">{feedback.detail}</p>}
              {feedback.action && (
                <button onClick={() => { feedback.action!.run(); setFeedback(null) }} className="mt-2 h-11 w-full rounded-xl bg-white text-sm font-bold text-black active:scale-[0.98]">
                  {feedback.action.label}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="pt-4 text-center text-sm text-white/50">{status === 'running' ? 'Listo para escanear…' : ''}</p>
        )}
        <button onClick={onClose} className="mt-3 h-12 w-full rounded-xl bg-white/10 text-base font-bold text-white active:scale-[0.98]">Listo</button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Download, Loader2, MonitorDown, WifiOff, RefreshCw } from 'lucide-react'
import CajaGoBrand from '@/components/brand/CajaGoBrand'
import { RELEASES_MANIFEST_URL, SUPPORT_WHATSAPP_URL } from '@/config/publicUrls'
import { TRIAL_DAYS } from '@/features/onboarding/registration'

// CajaGo se usa solo como programa de Windows: la web lleva acá para descargar el instalador.
export default function DownloadPage() {
  const [release, setRelease] = useState<{ version: string; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = 'Descargar CajaGo para Windows'
    fetch(`${RELEASES_MANIFEST_URL}?t=${Date.now()}`)
      .then(response => response.json())
      .then(manifest => {
        const url = manifest?.platforms?.['windows-x86_64']?.url
        if (url) setRelease({ version: manifest.version, url })
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [])

  const steps = [
    ['Descargá el instalador', 'Pesa unos 10 MB.'],
    ['Instalalo', 'Doble clic y listo: queda en el menú Inicio y en el escritorio. Si Windows muestra "Windows protegió su PC", tocá "Más información" y después "Ejecutar de todas formas" (pasa con los programas nuevos; las actualizaciones ya no lo muestran).'],
    ['Creá tu cuenta o ingresá', `Desde el mismo programa. ${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.`],
  ]

  return (
    <div className="cg-stage flex min-h-screen flex-col">
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1240px] items-center px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="CajaGo"><CajaGoBrand size="sm" /></Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-16 pt-8 text-center sm:pt-14">
        <p className="cg-pill"><span className="cg-dot" />Programa para Windows</p>
        <h1 className="cg-title mt-5 text-[clamp(2rem,6vw,3.25rem)]">
          Descargá CajaGo <span className="cg-accent block sm:inline">y empezá a vender.</span>
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-400 sm:text-base">
          CajaGo funciona como programa en tu computadora: más rápido, con impresora y lector de códigos, y sigue vendiendo aunque se corte internet.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {release ? (
            <a href={release.url} className="cg-btn-primary h-14 px-8 text-base">
              <Download className="h-5 w-5" /> Descargar para Windows
            </a>
          ) : failed ? (
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener" className="cg-btn-primary h-14 px-8 text-base">
              Pedí el instalador por WhatsApp
            </a>
          ) : (
            <span className="cg-btn-primary h-14 px-8 text-base opacity-70"><Loader2 className="h-5 w-5 animate-spin" /> Buscando la última versión…</span>
          )}
          {release && <p className="text-xs text-slate-500">Versión {release.version} · Windows 10 u 11</p>}
        </div>

        <div className="cg-card mt-12 w-full max-w-2xl p-6 text-left sm:p-8">
          <ol className="space-y-5">
            {steps.map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#9aa9ff]/15 text-sm font-bold text-[#9aa9ff]">{index + 1}</span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <li className="flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5 text-emerald-400/80" /> Funciona sin internet</li>
          <li className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-emerald-400/80" /> Se actualiza solo</li>
          <li className="flex items-center gap-1.5"><MonitorDown className="h-3.5 w-3.5 text-emerald-400/80" /> Tus datos sincronizados en la nube</li>
          <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400/80" /> Soporte humano</li>
        </ul>

        <p className="mt-10 text-sm text-slate-500">
          ¿Ya tenés CajaGo? Abrilo desde el menú Inicio de Windows.
        </p>
      </main>
    </div>
  )
}

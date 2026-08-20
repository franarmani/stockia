import { useState } from 'react'
import { ExternalLink, ChevronDown, AlertTriangle, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Guía del trámite de certificado ante AFIP.
 *
 * El wizard de Configuración asume que se sabe qué es un CSR y qué hay que
 * hacer en el sitio de AFIP. Acá se explica el trámite completo, incluida la
 * parte que ocurre fuera del sistema y que nadie puede hacer por el titular.
 */

interface Step {
  title: string
  where: 'stockia' | 'afip'
  body: React.ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Completá los datos fiscales',
    where: 'stockia',
    body: (
      <>
        <p>Acá abajo, en el paso 1 del asistente: CUIT, condición frente al IVA y punto de venta.</p>
        <p className="mt-1.5">
          El punto de venta tiene que ser uno habilitado para <strong>factura electrónica</strong> en AFIP.
          Si nunca lo diste de alta, se hace en el portal de AFIP, en
          «Administración de puntos de venta y domicilios».
        </p>
      </>
    ),
  },
  {
    title: 'Generá el pedido de certificado (CSR)',
    where: 'stockia',
    body: (
      <>
        <p>
          En el paso 2 tocás <strong>«Generar CSR»</strong> y se descarga un archivo.
          Es un pedido de certificado: no sirve por sí solo, hay que llevarlo a AFIP
          para que lo firme.
        </p>
        <p className="mt-1.5 text-white/40">Guardalo en un lugar que puedas encontrar; lo vas a subir en el paso siguiente.</p>
      </>
    ),
  },
  {
    title: 'Subí el CSR en AFIP y descargá el certificado',
    where: 'afip',
    body: (
      <>
        <p>
          Entrá a AFIP con la <strong>clave fiscal del titular</strong> (nivel 3 o superior) y buscá
          el servicio <strong>«Administración de Certificados Digitales»</strong>.
        </p>
        <ol className="list-decimal ml-4 mt-2 space-y-1 text-white/50">
          <li>«Agregar alias» y ponele un nombre, por ejemplo <code className="text-white/70">stockia</code>.</li>
          <li>Subí el archivo CSR que descargaste.</li>
          <li>AFIP te devuelve un certificado <code className="text-white/70">.crt</code>: descargalo.</li>
        </ol>
        <p className="mt-2">
          Si el servicio no te aparece en el listado, hay que habilitarlo primero desde
          «Administrador de Relaciones de Clave Fiscal».
        </p>
      </>
    ),
  },
  {
    title: 'Autorizá el servicio de facturación',
    where: 'afip',
    body: (
      <>
        <p>
          En <strong>«Administrador de Relaciones de Clave Fiscal»</strong> hay que darle permiso al
          certificado para facturar:
        </p>
        <ol className="list-decimal ml-4 mt-2 space-y-1 text-white/50">
          <li>«Nueva Relación» → Servicio → AFIP → WebServices.</li>
          <li>Elegí <strong>«Facturación Electrónica»</strong> (wsfe).</li>
          <li>Como representante, seleccioná el certificado que creaste recién.</li>
        </ol>
        <p className="mt-2 text-amber-400/70">
          Este paso se saltea seguido y es el motivo más común de que la conexión falle
          aunque el certificado esté bien subido.
        </p>
      </>
    ),
  },
  {
    title: 'Subí el certificado y probá la conexión',
    where: 'stockia',
    body: (
      <>
        <p>
          Volvé al paso 2 de acá abajo, subí el archivo <code className="text-white/70">.crt</code> y
          después probá la conexión en el paso 3.
        </p>
        <p className="mt-1.5">
          Si responde bien, el estado pasa a <strong className="text-green-400">conectada</strong> y
          en el punto de venta se habilitan las facturas A, B y C.
        </p>
      </>
    ),
  },
]

export default function AfipSetupGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.03] transition"
      >
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">¿Qué hay que hacer para poder facturar?</p>
          <p className="text-xs text-white/40">El trámite completo, paso a paso</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Lo que conviene saber antes de empezar */}
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
              <User className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white/80">Lo hace el titular</p>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Hacen falta la clave fiscal y el CUIT del dueño. También puede hacerlo el contador
                  si las tiene.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3">
              <Clock className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white/80">Una sola vez</p>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Toma unos 15 minutos. El certificado vale dos años y después se renueva.
                </p>
              </div>
            </div>
          </div>

          {/* Pasos */}
          <ol className="space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-white/8 text-white/60 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <span className={cn(
                      'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                      step.where === 'stockia'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-amber-500/15 text-amber-400'
                    )}>
                      {step.where === 'stockia' ? 'Acá' : 'En AFIP'}
                    </span>
                  </div>
                  <div className="text-xs text-white/55 leading-relaxed mt-1">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <a
            href="https://auth.afip.gob.ar/contribuyente_/login.xhtml"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white/80 transition"
          >
            Abrir AFIP con clave fiscal
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <p className="text-[11px] text-white/30 leading-relaxed">
            Mientras la conexión no esté lista podés seguir vendiendo: el punto de venta emite
            recibos en A4, que no son comprobantes fiscales.
          </p>
        </div>
      )}
    </div>
  )
}

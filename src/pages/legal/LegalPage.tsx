import { Link } from 'react-router-dom'
import CajaGoBrand from '@/components/brand/CajaGoBrand'
import { PLANS, formatPlanPrice } from '@/config/plans'
import { SUPPORT_WHATSAPP_URL } from '@/config/publicUrls'

const UPDATED = '26 de octubre de 2026'

type Section = { title: string; body: string[] }

const TERMS: Section[] = [
  { title: '1. El servicio', body: [
    'CajaGo es un sistema de gestión para comercios: punto de venta, stock, caja, clientes, facturación electrónica, compras, contabilidad y funciones relacionadas. Se usa mediante el programa para Windows y, de forma complementaria, desde la web.',
    'Al crear una cuenta aceptás estos términos. Si los usás en nombre de un negocio, declarás tener facultades para obligarlo.',
  ] },
  { title: '2. Prueba gratis, planes y pagos', body: [
    `Cada cuenta nueva tiene una prueba gratis de 5 días con todas las funciones. Después, el servicio se contrata por mes: plan ${PLANS.basic.name} (${formatPlanPrice(PLANS.basic.price)}) o plan ${PLANS.premium.name} (${formatPlanPrice(PLANS.premium.price)}), en pesos argentinos. Los precios pueden actualizarse avisando con al menos 15 días de anticipación.`,
    'El pago puede hacerse por débito automático con Mercado Pago o por transferencia. Las cuentas vinculadas que se pagan juntas abonan una mensualidad por negocio.',
    'No hay permanencia mínima: podés cancelar cuando quieras y seguís usando el servicio hasta el final del período pagado. No se reintegran períodos ya iniciados.',
    'Si la mensualidad no se paga, el acceso se suspende hasta regularizarla. Tus datos se conservan durante al menos 90 días desde la suspensión.',
  ] },
  { title: '3. Tus datos son tuyos', body: [
    'La información que cargás (productos, ventas, clientes, comprobantes, etc.) es tuya. CajaGo la procesa solo para prestar el servicio y no la vende ni la cede a terceros.',
    'Podés exportar tus productos y pedir una copia de tus datos en cualquier momento.',
  ] },
  { title: '4. Facturación electrónica', body: [
    'CajaGo solicita la autorización de comprobantes a ARCA (ex AFIP) con el certificado y los datos fiscales que cargás vos. Sos responsable de que esos datos, los importes y el tipo de comprobante sean correctos, y de tus obligaciones impositivas.',
    'Sin conexión, los comprobantes fiscales no pueden autorizarse: quedan pendientes hasta que vuelva la conexión.',
  ] },
  { title: '5. Uso adecuado', body: [
    'No podés usar CajaGo para actividades ilegales, para enviar mensajes no solicitados (spam) por WhatsApp ni para intentar acceder a datos de otros negocios. El incumplimiento puede causar la suspensión de la cuenta.',
    'Sos responsable de las cuentas de usuario que crees para tu equipo y de mantener tus contraseñas en reserva.',
  ] },
  { title: '6. Servicios de terceros', body: [
    'Algunas funciones usan servicios externos: Mercado Pago (cobros y suscripciones), ARCA (facturación), Z-API/WhatsApp (mensajería) y proveedores de nube e inteligencia artificial. Su funcionamiento depende de esos proveedores y de sus propias condiciones.',
  ] },
  { title: '7. Disponibilidad y responsabilidad', body: [
    'Trabajamos para que CajaGo esté siempre disponible y el programa de escritorio sigue funcionando sin internet, pero no garantizamos un servicio libre de interrupciones o errores.',
    'En la medida permitida por la ley, la responsabilidad de CajaGo se limita al importe pagado por el servicio en los últimos tres meses. CajaGo no responde por lucro cesante ni por decisiones comerciales tomadas a partir de la información del sistema.',
  ] },
  { title: '8. Cambios y ley aplicable', body: [
    'Podemos actualizar estos términos; los cambios relevantes se avisan dentro del sistema. Rigen las leyes de la República Argentina, incluida la Ley 24.240 de Defensa del Consumidor cuando corresponda.',
  ] },
]

const PRIVACY: Section[] = [
  { title: '1. Qué datos tratamos', body: [
    'Datos de la cuenta: nombre, email, teléfono y datos del negocio (razón social, CUIT, dirección, condición frente al IVA).',
    'Datos que cargás para operar: productos, ventas, caja, clientes y sus datos de contacto o fiscales, proveedores, comprobantes y mensajes de WhatsApp gestionados desde CajaGo.',
    'Datos técnicos: identificador del equipo, versión del programa y registros de errores para dar soporte.',
  ] },
  { title: '2. Para qué los usamos', body: [
    'Para prestar el servicio, sincronizar tus equipos, autorizar comprobantes ante ARCA, procesar cobros, dar soporte y avisarte sobre tu suscripción. No usamos tus datos para publicidad de terceros.',
  ] },
  { title: '3. Dónde se guardan', body: [
    'En la nube de Supabase (con aislamiento por negocio) y, en el programa de escritorio, en una base local en tu computadora para que funcione sin internet. Las contraseñas no se guardan en texto: el acceso sin conexión usa una huella cifrada.',
  ] },
  { title: '4. Con quién se comparten', body: [
    'Solo con los proveedores necesarios para cada función (Supabase, Mercado Pago, ARCA, Z-API y el proveedor de inteligencia artificial del asistente), y con autoridades cuando la ley lo exija.',
  ] },
  { title: '5. Tus derechos', body: [
    'Conforme a la Ley 25.326 de Protección de los Datos Personales podés acceder, rectificar, actualizar o pedir la supresión de tus datos escribiéndonos por WhatsApp. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende denuncias y reclamos por incumplimientos.',
    'Si cargás datos de tus clientes, vos sos responsable de esa base y CajaGo actúa como encargado de su tratamiento.',
  ] },
  { title: '6. Conservación', body: [
    'Conservamos los datos mientras la cuenta esté activa y hasta 90 días después de su baja, salvo que la ley exija guardarlos más tiempo (por ejemplo, información fiscal).',
  ] },
]

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const sections = kind === 'terms' ? TERMS : PRIVACY
  const title = kind === 'terms' ? 'Términos y condiciones' : 'Política de privacidad'

  return (
    <div className="min-h-screen bg-[#090c11] text-[#f5f7fa]">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/"><CajaGoBrand size="sm" /></Link>
          <Link to={kind === 'terms' ? '/privacidad' : '/terminos'} className="text-xs font-semibold text-slate-400 hover:text-white">
            {kind === 'terms' ? 'Política de privacidad' : 'Términos y condiciones'}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {UPDATED}</p>
        <div className="mt-10 space-y-8">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-white">{section.title}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index} className="mt-3 text-sm leading-7 text-slate-300">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-slate-400">
          ¿Consultas? Escribinos por <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener" className="text-[#8da0ff] hover:underline">WhatsApp</a>.
        </p>
      </main>
    </div>
  )
}

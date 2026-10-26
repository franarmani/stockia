import { Bot, CheckCircle2, Clock3, MessageCircle, QrCode, ShieldCheck, Sparkles } from 'lucide-react'

const activationSteps = [
  {
    icon: MessageCircle,
    title: 'Abrís WhatsApp IA',
    description: 'La conexión se inicia directamente desde CajaGo.',
  },
  {
    icon: QrCode,
    title: 'Escaneás un QR',
    description: 'Vinculás el número comercial, como en WhatsApp Web.',
  },
  {
    icon: Bot,
    title: 'El asistente queda listo',
    description: 'Responde consultas y deriva las conversaciones que necesitan una persona.',
  },
]

export default function WhatsAppPage() {
  return (
    <div className="animate-fade-in mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-6xl items-center py-6">
      <section className="relative w-full overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d141f] p-6 sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#8295ff]/[0.06] blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                <MessageCircle className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">WhatsApp IA</p>
                <p className="text-xs text-white/40">Atención inteligente integrada a CajaGo</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
              <Clock3 className="h-3.5 w-3.5" /> En preparación
            </span>
          </div>

          <div className="mt-12 max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-4 w-4" /> Una conexión simple y segura
            </div>
            <h1 className="max-w-2xl text-balance text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
              Tu WhatsApp, conectado sin configuraciones técnicas.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
              Estamos terminando una integración administrada completamente por CajaGo. Cuando esté disponible, no vas a crear cuentas externas ni realizar configuraciones técnicas.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {activationSteps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-white/70">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs text-white/20">0{index + 1}</span>
                </div>
                <h2 className="mt-5 text-sm font-bold text-white">{step.title}</h2>
                <p className="mt-2 text-xs leading-5 text-white/40">{step.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-bold text-white">No necesitás configurar nada por ahora</p>
                <p className="mt-1 text-xs leading-5 text-white/45">CajaGo te avisará cuando la conexión segura esté habilitada para tu negocio.</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Sin cuentas externas
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

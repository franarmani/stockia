import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LifeBuoy, Lightbulb, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GUIDES, searchGuides, type Guide } from '@/features/help/guides'

const CATEGORIES: Guide['category'][] = ['Empezar', 'Vender', 'Mercadería', 'Clientes', 'Caja y números', 'Vender más', 'Cuenta']

export default function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(GUIDES[0].id)
  const results = useMemo(() => searchGuides(query), [query])

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto w-full pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)]">Ayuda</h1>
          <p className="text-sm text-white/40">Guías cortas para hacer cada cosa en CajaGo.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="¿Qué querés hacer? Por ejemplo: anular una venta"
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40"
        />
      </div>

      {results.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">No encontramos una guía para eso. Escribinos desde Configuración → Suscripción → "Hablar con soporte".</p>
      )}

      {CATEGORIES.map((category) => {
        const guides = results.filter((g) => g.category === category)
        if (guides.length === 0) return null
        return (
          <section key={category} className="space-y-2">
            <p className="px-1 text-[12px] font-medium text-white/40">{category}</p>
            <div className="rounded-2xl border border-white/8 bg-[#0d1b2d] divide-y divide-white/5 overflow-hidden">
              {guides.map((guide) => {
                const expanded = open === guide.id || query.trim() !== ''
                return (
                  <div key={guide.id}>
                    <button onClick={() => setOpen(open === guide.id ? null : guide.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
                      <span className="text-sm font-semibold text-white">{guide.title}</span>
                      <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', expanded && 'rotate-180')} />
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-3">
                        <ol className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-white/75">
                              <span className="w-5 h-5 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold grid place-items-center">{i + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                        {guide.tip && (
                          <p className="flex gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2 text-xs text-amber-100/80">
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" /> {guide.tip}
                          </p>
                        )}
                        {guide.path && (
                          <button onClick={() => navigate(guide.path!)} className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110">
                            Ir a la pantalla
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

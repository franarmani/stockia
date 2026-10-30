import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LifeBuoy, Lightbulb, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GUIDES, searchGuides, type Guide } from '@/features/help/guides'
import Button from '@/components/ui/Button'

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
          <p className="text-sm text-muted-foreground">Guías cortas para hacer cada cosa en CajaGo.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="¿Qué querés hacer? Por ejemplo: anular una venta"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-surface text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-xs transition-all"
        />
      </div>

      {results.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No encontramos una guía para eso. Escribinos desde Configuración → Suscripción → "Hablar con soporte".</p>
      )}

      {CATEGORIES.map((category) => {
        const guides = results.filter((g) => g.category === category)
        if (guides.length === 0) return null
        return (
          <section key={category} className="space-y-2.5">
            <p className="px-1 text-[12px] font-bold text-muted-foreground uppercase tracking-wider">{category}</p>
            <div className="cg-card overflow-hidden divide-y divide-border/60">
              {guides.map((guide) => {
                const expanded = open === guide.id || query.trim() !== ''
                return (
                  <div key={guide.id}>
                    <button onClick={() => setOpen(open === guide.id ? null : guide.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-secondary/60 transition-colors cursor-pointer">
                      <span className="text-sm font-bold text-foreground">{guide.title}</span>
                      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-3 pt-1">
                        <ol className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-foreground/90 leading-relaxed">
                              <span className="w-5 h-5 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold grid place-items-center mt-0.5">{i + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                        {guide.tip && (
                          <div className="flex gap-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs text-amber-950 dark:text-amber-200 font-medium">
                            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <span className="leading-relaxed">{guide.tip}</span>
                          </div>
                        )}
                        {guide.path && (
                          <Button size="sm" onClick={() => navigate(guide.path!)} className="text-xs font-bold mt-2">
                            Ir a la pantalla
                          </Button>
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

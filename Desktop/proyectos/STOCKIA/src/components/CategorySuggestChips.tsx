import type { Suggestion } from '@/lib/categorySuggest'
import { Sparkles, Check, Info } from 'lucide-react'
import { useState } from 'react'

interface Props {
  suggestions: Suggestion[]
  loading: boolean
  currentCategoryId: string
  onApply: (categoryId: string) => void
}

const CONFIDENCE_COLORS: Record<string, string> = {
  'Muy probable': 'bg-green-100 text-green-700 border-green-200',
  'Probable': 'bg-blue-100 text-blue-700 border-blue-200',
  'Sugerencia': 'bg-amber-100 text-amber-700 border-amber-200',
}

const CONFIDENCE_DOTS: Record<string, string> = {
  'Muy probable': 'bg-green-500',
  'Probable': 'bg-blue-500',
  'Sugerencia': 'bg-amber-500',
}

export default function CategorySuggestChips({ suggestions, loading, currentCategoryId, onApply }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="flex items-center gap-2 mt-1.5 animate-pulse">
        <Sparkles className="w-3 h-3 text-primary/40" />
        <span className="text-[11px] text-muted-foreground/50">Analizando nombre...</span>
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sugerencias IA</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, i) => {
          const isActive = currentCategoryId === s.category_id
          const colors = CONFIDENCE_COLORS[s.confidence] || CONFIDENCE_COLORS['Sugerencia']
          const dotColor = CONFIDENCE_DOTS[s.confidence] || CONFIDENCE_DOTS['Sugerencia']

          return (
            <div key={s.category_id} className="relative">
              <button
                type="button"
                onClick={() => onApply(s.category_id)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`
                  inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-semibold
                  transition-all active:scale-95 cursor-pointer
                  ${isActive
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                    : `${colors} hover:shadow-sm`
                  }
                `}
              >
                {isActive ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                )}
                <span className="max-w-[140px] truncate">{s.path}</span>
                <span className={`text-[9px] font-normal ${isActive ? 'text-white/70' : 'opacity-60'}`}>{s.score}%</span>
              </button>

              {/* Tooltip with reasons */}
              {hoveredIdx === i && (
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-56 px-3 py-2 rounded-xl bg-slate-900 text-white shadow-xl text-[11px] animate-fade-in pointer-events-none">
                  <div className="flex items-center gap-1 mb-1">
                    <Info className="w-3 h-3 text-white/50" />
                    <span className="font-semibold text-white/80">{s.confidence}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {s.reasons.map((r, ri) => (
                      <li key={ri} className="text-white/60 leading-snug">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { Check, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLANS, PLAN_ORDER, formatPlanPrice, type PlanId } from '@/config/plans'

/** Selector de plan con el precio total (incluye las cuentas vinculadas que se pagan juntas). */
export default function PlanPicker({
  value,
  onChange,
  linkedCount = 0,
  compact = false,
}: {
  value: PlanId
  onChange: (plan: PlanId) => void
  linkedCount?: number
  compact?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id]
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'text-left rounded-xl border p-3 transition-all',
              selected ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                {id !== 'basic' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                {plan.name}
              </span>
              {selected && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="mt-1 font-mono text-sm font-bold text-white">
              {formatPlanPrice(plan.price * (1 + linkedCount))}
              <span className="text-[11px] font-normal text-white/40"> /mes</span>
            </p>
            {!compact && <p className="mt-1 text-[11px] leading-4 text-white/45">{plan.tagline}</p>}
          </button>
        )
      })}
    </div>
  )
}

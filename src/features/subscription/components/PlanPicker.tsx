import { Check, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLANS, PLAN_ORDER, formatPlanPrice, type PlanId } from '@/config/plans'

/** Selector de plan. Precio por negocio; el VIP incluye las sucursales vinculadas. */
export default function PlanPicker({
  value,
  onChange,
  compact = false,
}: {
  value: PlanId
  onChange: (plan: PlanId) => void
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
              selected ? 'border-[#9aa9ff]/50 bg-[#9aa9ff]/[0.08]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                {id !== 'basic' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                {plan.name}
              </span>
              {selected && <Check className="w-4 h-4 text-[#9aa9ff]" />}
            </div>
            <p className="mt-1 text-[15px] font-semibold text-white tabular-nums">
              {formatPlanPrice(plan.price)}
              <span className="text-[11px] font-normal text-white/40"> /mes</span>
            </p>
            {!compact && <p className="mt-1 text-[11px] leading-4 text-white/45">{plan.tagline}</p>}
          </button>
        )
      })}
    </div>
  )
}

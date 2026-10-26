import { useNavigate } from 'react-router-dom'
import { Check, Crown } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import { FEATURE_PLAN, PLANS, PREMIUM_FEATURE_LABELS, type PremiumFeature } from '@/config/plans'

/** Muestra la sección si el plan la incluye; si no, invita a pasar a Premium. */
export default function PlanGate({ feature, children }: { feature: PremiumFeature; children: React.ReactNode }) {
  const { hasFeature, planInfo } = usePlan()
  const navigate = useNavigate()

  if (hasFeature(feature)) return <>{children}</>

  const required = PLANS[FEATURE_PLAN[feature]]
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
        <Crown className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{PREMIUM_FEATURE_LABELS[feature]} está en el plan {required.name}</h2>
      <p className="text-sm text-white/50 mb-6">
        Tu plan actual es {planInfo.name}. Pasate a {required.name} por {required.priceLabel} y sumá todas estas funciones:
      </p>
      <ul className="w-full text-left space-y-2 mb-7">
        {required.features.slice(1).map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-white/70">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
      <button
        onClick={() => navigate('/settings?tab=subscription')}
        className="px-6 h-11 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-110 transition-all"
      >
        Pasar a {required.name}
      </button>
    </div>
  )
}

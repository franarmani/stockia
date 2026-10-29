import { useState } from 'react'
import { Gift, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canRedeem, pointsForPurchase, type LoyaltyConfig, type LoyaltyRedemption, type LoyaltyReward } from './loyalty'

/** Puntos del cliente, lo que suma con esta compra y premios para canjear (en el cobro del POS). */
export default function LoyaltyRedeemPanel({
  customerName,
  customerPoints,
  config,
  rewards,
  cartProductIds,
  total,
  redemption,
  onRedeem,
  onRemove,
}: {
  customerName: string
  customerPoints: number
  config: LoyaltyConfig
  rewards: LoyaltyReward[]
  cartProductIds: string[]
  total: number
  redemption: LoyaltyRedemption | null
  onRedeem: (reward: LoyaltyReward) => void
  onRemove: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const available = customerPoints - (redemption?.points ?? 0)
  const toEarn = pointsForPurchase(total, config)

  const activeRewards = rewards
    .filter((reward) => reward.active)
    .sort((a, b) => a.points_cost - b.points_cost)

  // Evaluate canRedeem for each reward
  const evaluatedRewards = activeRewards.map((reward) => ({
    reward,
    check: canRedeem(reward, customerPoints, cartProductIds),
  }))

  const redeemable = evaluatedRewards.filter((e) => e.check.ok)
  const notRedeemable = evaluatedRewards.filter((e) => !e.check.ok)
  // Show available rewards first, then the ones missing points or products
  const sortedEvaluated = [...redeemable, ...notRedeemable]

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 sm:p-3 space-y-2 text-left">
      {/* Header bar: points & earnings */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5 truncate">
          <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Club de puntos · {customerName}</span>
        </span>
        <span className="text-xs font-black text-amber-300 tabular-nums shrink-0 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
          {available} pts
        </span>
      </div>

      {toEarn > 0 && (
        <p className="text-[10px] sm:text-[11px] text-amber-200/70 leading-tight">
          Con esta compra suma <span className="font-bold text-amber-300">+{toEarn}</span> punto{toEarn !== 1 ? 's' : ''}.
        </p>
      )}

      {/* If redemption is active: display selected reward badge */}
      {redemption ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-black/30 border border-amber-500/30 px-2.5 py-1.5">
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-white truncate">
              Canje: <b className="text-amber-200">{redemption.name}</b> <span className="text-white/60 text-[11px]">(−{redemption.points} pts)</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="w-6 h-6 rounded-md flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors shrink-0"
            title="Quitar canje"
            aria-label="Quitar canje"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : activeRewards.length > 0 ? (
        <div className="space-y-1.5">
          {/* Collapsible toggle bar */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all active:scale-[0.99]',
              redeemable.length > 0
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-200 font-bold shadow-sm'
                : 'bg-black/20 hover:bg-black/30 border-white/10 text-white/70 font-medium'
            )}
          >
            <span className="flex items-center gap-1.5 truncate text-[11px]">
              {redeemable.length > 0 ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span className="truncate">
                    <b>{redeemable.length}</b> {redeemable.length === 1 ? 'premio para canjear' : 'premios para canjear'}
                  </span>
                </>
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  <span className="truncate">Ver catálogo de premios ({activeRewards.length})</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider shrink-0 font-bold opacity-80">
              {isExpanded ? 'Ocultar' : 'Ver'}
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {/* Collapsible rewards list with constrained height */}
          {isExpanded && (
            <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar border-t border-amber-500/15 pt-2">
              {sortedEvaluated.map(({ reward, check }) => (
                <div
                  key={reward.id}
                  className={cn(
                    'flex items-center justify-between gap-2 p-1.5 rounded-lg border transition-all',
                    check.ok
                      ? 'bg-amber-500/10 border-amber-500/25'
                      : 'bg-white/[0.02] border-white/5 opacity-70'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate leading-tight">{reward.name}</p>
                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">
                      <span className="font-bold text-amber-300">{reward.points_cost} pts</span>
                      {!check.ok && check.reason ? ` · ${check.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!check.ok}
                    onClick={() => {
                      onRedeem(reward)
                      setIsExpanded(false)
                    }}
                    className={cn(
                      'h-6 px-2.5 rounded-md text-[10px] font-bold shrink-0 transition-all',
                      check.ok
                        ? 'bg-amber-500 text-black hover:bg-amber-400 active:scale-95 shadow-sm'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                    )}
                  >
                    Canjear
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-white/40 italic">Todavía no hay premios cargados.</p>
      )}
    </div>
  )
}

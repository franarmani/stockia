import { Gift, X } from 'lucide-react'
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
  const available = customerPoints - (redemption?.points ?? 0)
  const toEarn = pointsForPurchase(total, config)
  const activeRewards = rewards.filter((reward) => reward.active).sort((a, b) => a.points_cost - b.points_cost)

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Club de puntos · {customerName}
        </span>
        <span className="text-xs font-bold text-white tabular-nums">{available} pts</span>
      </div>
      {toEarn > 0 && <p className="text-[11px] text-amber-200/70">Con esta compra suma {toEarn} punto{toEarn !== 1 ? 's' : ''}.</p>}

      {redemption ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-2">
          <span className="text-xs text-white">Canje: <b>{redemption.name}</b> (−{redemption.points} pts)</span>
          <button onClick={onRemove} className="w-6 h-6 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10" aria-label="Quitar canje">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : activeRewards.length > 0 ? (
        <div className="space-y-1.5">
          {activeRewards.map((reward) => {
            const check = canRedeem(reward, customerPoints, cartProductIds)
            return (
              <div key={reward.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{reward.name}</p>
                  <p className="text-[10px] text-white/40">{reward.points_cost} pts{!check.ok && check.reason ? ` · ${check.reason}` : ''}</p>
                </div>
                <button
                  disabled={!check.ok}
                  onClick={() => onRedeem(reward)}
                  className={cn('h-7 px-2.5 rounded-lg text-[11px] font-bold shrink-0', check.ok ? 'bg-amber-500 text-black hover:brightness-110' : 'bg-white/5 text-white/30')}
                >
                  Canjear
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Todavía no hay premios cargados.</p>
      )}
    </div>
  )
}

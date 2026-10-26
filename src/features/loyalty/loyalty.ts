import type { PricedLine } from '@/features/promotions/promotionEngine'

export interface LoyaltyConfig {
  enabled: boolean
  /** 1 punto cada tantos pesos gastados. */
  amount_per_point: number
}

export type RewardKind = 'product' | 'percent'

export interface LoyaltyReward {
  id: string
  name: string
  points_cost: number
  kind: RewardKind
  product_id: string | null
  percent: number | null
  active: boolean
  created_at?: string
}

/** Canje elegido en el punto de venta (se descuentan los puntos al cobrar). */
export interface LoyaltyRedemption {
  rewardId: string
  name: string
  points: number
  kind: RewardKind
  productId?: string | null
  percent?: number | null
  /** Descuento manual que había antes de un canje de %, para poder deshacerlo. */
  previousDiscount?: number
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = { enabled: false, amount_per_point: 1000 }

export function readLoyaltyConfig(raw: unknown): LoyaltyConfig {
  const config = (raw ?? {}) as Partial<LoyaltyConfig>
  const amount = Number(config.amount_per_point)
  return {
    enabled: config.enabled === true,
    amount_per_point: Number.isFinite(amount) && amount > 0 ? amount : DEFAULT_LOYALTY_CONFIG.amount_per_point,
  }
}

export function pointsForPurchase(total: number, config: LoyaltyConfig): number {
  if (!config.enabled || config.amount_per_point <= 0 || total <= 0) return 0
  return Math.floor(total / config.amount_per_point + 1e-9)
}

/** Dos descuentos porcentuales seguidos expresados como uno solo (10% y 10% = 19%). */
export function combineDiscounts(firstPct: number, secondPct: number): number {
  const combined = 100 * (1 - (1 - firstPct / 100) * (1 - secondPct / 100))
  return Math.round(combined * 10000) / 10000
}

/** Bonifica una unidad del producto del premio. Devuelve null si el producto no está en la venta. */
export function applyFreeUnit(lines: PricedLine[], productId: string, rewardName: string): PricedLine[] | null {
  const index = lines.findIndex((line) => line.product.id === productId && line.price > 0 && line.quantity >= 1)
  if (index === -1) return null
  const line = lines[index]
  const promotion = { promotionId: 'loyalty', name: rewardName, amount: line.price }
  const rest = Math.round((line.quantity - 1) * 1000) / 1000
  const replacement: PricedLine[] = [
    ...(rest > 0 ? [{ ...line, quantity: rest }] : []),
    { ...line, quantity: 1, price: 0, promotion },
  ]
  return [...lines.slice(0, index), ...replacement, ...lines.slice(index + 1)]
}

export function canRedeem(reward: LoyaltyReward, customerPoints: number, cartProductIds: string[]): { ok: boolean; reason?: string } {
  if (!reward.active) return { ok: false, reason: 'Premio pausado' }
  if (customerPoints < reward.points_cost) return { ok: false, reason: `Le faltan ${reward.points_cost - customerPoints} puntos` }
  if (reward.kind === 'product' && (!reward.product_id || !cartProductIds.includes(reward.product_id))) {
    return { ok: false, reason: 'Agregá el producto al carrito' }
  }
  return { ok: true }
}

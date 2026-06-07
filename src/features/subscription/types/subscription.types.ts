export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'failed'

export interface BusinessSubscription {
  id: string
  business_id: string
  plan_id: string
  status: SubscriptionStatus
  billing_cycle: string
  subscription_start_at: string
  subscription_end_at: string
  last_payment_at: string | null
  next_payment_due_at: string | null
  grace_period_end_at: string | null
  payment_status: PaymentStatus
  created_at: string
  updated_at: string
}

export interface SubscriptionDateState {
  daysRemaining: number
  daysElapsed: number
  totalDays: number
  isExpired: boolean
  expiresToday: boolean
  expirationDate: Date
}

export interface SubscriptionBannerState {
  variant: 'normal' | 'soon' | 'urgent' | 'expires_today' | 'expired' | 'loading' | 'error'
  daysRemaining: number
  endDate: Date
  message: string
  actionLabel: string
  actionPath: string
}

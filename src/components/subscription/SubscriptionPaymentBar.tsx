import { useMemo } from 'react'
import { CalendarClock, CreditCard, AlertCircle } from 'lucide-react'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/features/subscription'
import { PLANS, formatPlanPrice, normalizePlan } from '@/config/plans'
import { formatSubscriptionDate } from '@/features/subscription/utils/subscriptionDates'
import { cn } from '@/lib/utils'

interface SubscriptionPaymentBarProps {
  onOpenPayment: () => void
  className?: string
}

export default function SubscriptionPaymentBar({ onOpenPayment, className }: SubscriptionPaymentBarProps) {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const {
    daysRemaining,
    isExpired,
    expiresToday,
    status
  } = useSubscription()

  const isSuperAdmin = profile?.is_superadmin
  const hasAutoDebit = business?.mp_subscription_status === 'authorized'
  const trialEndsAt = business?.trial_ends_at

  const planId = normalizePlan(business?.plan)
  const plan = PLANS[planId]
  const planPrice = plan?.price || 70000
  const formattedPrice = formatPlanPrice(planPrice)
  const pendingNote = business?.pending_discount_note

  // Do not show for superadmin or if account has active automatic debit
  if (isSuperAdmin || hasAutoDebit) return null

  // If no trialEndsAt and active, no payment due
  if (!trialEndsAt && status === 'active') return null

  const isUrgent = expiresToday || isExpired || daysRemaining === 0
  const isTomorrow = daysRemaining === 1 && !isExpired

  // Status badge styling and text
  const badgeConfig = useMemo(() => {
    if (isExpired) {
      return {
        label: 'Suscripción vencida',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        containerBorder: 'border-rose-500/30 bg-rose-500/[0.04] dark:bg-rose-950/20',
        iconClass: 'text-rose-500',
        ctaText: 'Pagar con Mercado Pago',
        ctaClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30',
      }
    }
    if (expiresToday || daysRemaining === 0) {
      return {
        label: 'Tu mensualidad vence hoy',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        containerBorder: 'border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-950/20',
        iconClass: 'text-amber-500',
        ctaText: 'Pagar con Mercado Pago',
        ctaClass: 'bg-[#009ee3] hover:bg-[#0081bb] text-white shadow-sky-900/30',
      }
    }
    if (isTomorrow) {
      return {
        label: 'Vence mañana',
        badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
        containerBorder: 'border-orange-500/30 bg-orange-500/[0.04] dark:bg-orange-950/20',
        iconClass: 'text-orange-500',
        ctaText: 'Pagar con Mercado Pago',
        ctaClass: 'bg-[#009ee3] hover:bg-[#0081bb] text-white shadow-sky-900/30',
      }
    }
    return {
      label: `${daysRemaining} ${daysRemaining === 1 ? 'día restante' : 'días restantes'}`,
      badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      containerBorder: 'border-indigo-500/20 bg-indigo-500/[0.03] dark:bg-indigo-950/15',
      iconClass: 'text-indigo-400',
      ctaText: 'Pagar suscripción',
      ctaClass: 'bg-white/10 hover:bg-white/20 text-foreground dark:text-white border border-white/15',
    }
  }, [isExpired, expiresToday, daysRemaining, isTomorrow])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3.5 sm:px-5 sm:py-3.5 transition-all shadow-sm',
        badgeConfig.containerBorder,
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        {/* Left: Remaining days & amount to pay */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/5 border border-white/10', badgeConfig.iconClass)}>
            <CalendarClock className="w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 text-xs sm:text-sm">
            {/* Days remaining badge */}
            <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0', badgeConfig.badgeClass)}>
              {badgeConfig.label}
            </span>

            {/* Expiration date description */}
            {!isExpired && trialEndsAt && (
              <span className="text-muted-foreground text-xs hidden md:inline">
                (vence el {formatSubscriptionDate(trialEndsAt)})
              </span>
            )}

            <span className="text-muted-foreground hidden sm:inline">·</span>

            {/* Amount to pay */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground font-medium text-xs sm:text-sm">A abonar:</span>
              <span className="font-bold text-foreground dark:text-white text-xs sm:text-sm font-mono">
                {formattedPrice}
              </span>
              <span className="text-[11px] text-muted-foreground">({plan.name})</span>
            </div>

            {/* Pending discount or custom note */}
            {pendingNote && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[220px]" title={pendingNote}>{pendingNote}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Payment CTA */}
        <div className="shrink-0 flex items-center self-end sm:self-center">
          <button
            type="button"
            onClick={onOpenPayment}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]',
              badgeConfig.ctaClass
            )}
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>{badgeConfig.ctaText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

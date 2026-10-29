import { useNavigate } from 'react-router-dom'
import { CalendarClock, ShieldCheck, ChevronRight, AlertCircle, Sparkles } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { formatSubscriptionDate } from '../utils/subscriptionDates'
import { cn } from '@/lib/utils'

export default function SubscriptionStatusWidget() {
  const navigate = useNavigate()
  const {
    subscription: business,
    planName,
    daysRemaining,
    isExpired,
    expiresToday,
    status,
    totalDays,
    isLoading,
  } = useSubscription()

  if (isLoading) {
    return (
      <div className="h-24 w-full rounded-2xl bg-white/[0.03] border border-white/8 animate-pulse" />
    )
  }

  const trialEndsAt = business?.trial_ends_at
  const pendingNote = business?.pending_discount_note

  // Percent of cycle left (for progress bar)
  const safeTotal = totalDays > 0 ? totalDays : 30
  const progressPercent = Math.min(100, Math.max(0, Math.round((daysRemaining / safeTotal) * 100)))

  // Visual status
  const isUrgent = daysRemaining <= 3 && !isExpired
  const isWarning = daysRemaining <= 7 && !isUrgent && !isExpired

  const badgeColor = isExpired
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    : isUrgent
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : isWarning
    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'

  const statusLabel = isExpired
    ? 'Vencida'
    : expiresToday
    ? 'Vence hoy'
    : isUrgent
    ? 'Vence pronto'
    : 'Activa'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1b2d] via-[#10223a] to-[#0a1524] p-4 sm:p-5 shadow-lg">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-600/10 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
            <CalendarClock className="w-5 h-5 text-indigo-300" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Suscripción
              </span>
              <span className="text-xs font-semibold text-white/80">·</span>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {planName}
              </span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', badgeColor)}>
                {statusLabel}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white tabular-nums">
                {isExpired ? (
                  <span className="text-rose-400">Suscripción vencida</span>
                ) : expiresToday ? (
                  <span className="text-amber-400">Vence hoy</span>
                ) : (
                  <>
                    {daysRemaining}{' '}
                    <span className="text-base sm:text-lg font-bold text-slate-300">
                      {daysRemaining === 1 ? 'día disponible' : 'días disponibles'}
                    </span>
                  </>
                )}
              </h3>
            </div>

            <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              {trialEndsAt ? (
                <>
                  <span>Vence el</span>
                  <span className="font-semibold text-slate-200">
                    {formatSubscriptionDate(trialEndsAt)}
                  </span>
                </>
              ) : status === 'active' ? (
                <span>Plan sin fecha de caducidad fijada</span>
              ) : (
                <span>Regularizá tu suscripción para continuar sin interrupciones</span>
              )}
            </p>

            {pendingNote && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pendingNote}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions and Progress */}
        <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 sm:min-w-[200px]">
          <button
            onClick={() => navigate('/settings?tab=subscription')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition-all active:scale-[0.98] shadow-sm hover:border-white/20 w-full sm:w-auto"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Gestionar suscripción</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          </button>

          {!isExpired && daysRemaining > 0 && (
            <div className="w-full sm:w-44 space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>Tiempo restante</span>
                <span className="font-bold text-white tabular-nums">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isUrgent
                      ? 'bg-amber-400'
                      : isWarning
                      ? 'bg-yellow-400'
                      : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 w-52 h-52 rounded-full bg-indigo-500/10 blur-3xl" />
    </div>
  )
}

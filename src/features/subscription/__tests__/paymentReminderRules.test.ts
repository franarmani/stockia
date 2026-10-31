import { describe, expect, it } from 'vitest'
import { PLANS, formatPlanPrice, normalizePlan, type PlanId } from '@/config/plans'
import { calculateRawRemainingDays, getSubscriptionDateState } from '../utils/subscriptionDates'

describe('Payment reminder and subscription bar rules', () => {
  it('correctly formats plan pricing for all tiers', () => {
    expect(formatPlanPrice(PLANS['vip'].price)).toBe('$110.000')
    expect(formatPlanPrice(PLANS['premium'].price)).toBe('$70.000')
    expect(formatPlanPrice(PLANS['basic'].price)).toBe('$38.000')
  })

  it('determines the day before payment when daysRemaining is exactly 1', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const state = getSubscriptionDateState(tomorrow.toISOString())

    expect(state.daysRemaining).toBe(1)
    expect(state.isExpired).toBe(false)
    expect(state.expiresToday).toBe(false)
  })

  it('determines the payment day when expiration is today (daysRemaining 0)', () => {
    const today = new Date()
    const state = getSubscriptionDateState(today.toISOString())

    expect(state.daysRemaining).toBe(0)
    expect(state.expiresToday).toBe(true)
  })

  it('evaluates whether day-before popup should trigger only once', () => {
    const storage: Record<string, string> = {}
    const cycleDate = '2026-11-01'
    const businessId = 'biz-123'
    const key = `cajago_pay_reminder_day_before_${businessId}_${cycleDate}`

    function shouldShowDayBefore(daysRemaining: number, autoDebit: boolean, isSuperAdmin: boolean): boolean {
      if (isSuperAdmin || autoDebit) return false
      if (daysRemaining !== 1) return false
      if (storage[key]) return false
      storage[key] = '1'
      return true
    }

    // First time: triggers
    expect(shouldShowDayBefore(1, false, false)).toBe(true)
    // Second time: does NOT trigger (already shown once)
    expect(shouldShowDayBefore(1, false, false)).toBe(false)
    // Other days: does NOT trigger
    expect(shouldShowDayBefore(2, false, false)).toBe(false)
    expect(shouldShowDayBefore(0, false, false)).toBe(false)
    // If auto debit active: does NOT trigger
    delete storage[key]
    expect(shouldShowDayBefore(1, true, false)).toBe(false)
  })

  it('evaluates payment day popup triggers on day 0 or expired', () => {
    const sessionStorageMock: Record<string, string> = {}
    const cycleDate = '2026-11-01'
    const businessId = 'biz-123'
    const key = `cajago_pay_reminder_day_of_${businessId}_${cycleDate}`

    function shouldShowPaymentDay(daysRemaining: number, isExpired: boolean, autoDebit: boolean): boolean {
      if (autoDebit) return false
      if (daysRemaining > 0 && !isExpired) return false
      if (sessionStorageMock[key]) return false
      sessionStorageMock[key] = '1'
      return true
    }

    // Payment day (daysRemaining === 0)
    expect(shouldShowPaymentDay(0, false, false)).toBe(true)
    // Repeated in same session: does NOT spam
    expect(shouldShowPaymentDay(0, false, false)).toBe(false)

    // Expired
    delete sessionStorageMock[key]
    expect(shouldShowPaymentDay(0, true, false)).toBe(true)
  })
})


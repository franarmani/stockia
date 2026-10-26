import { describe, expect, it } from 'vitest'
import { creditScore, exceedsCreditLimit, oldestUnpaidDays } from '../creditScore'

const now = new Date('2026-10-26T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString()

describe('customer credit score', () => {
  it('debt is matched to the most recent charges', () => {
    const charges = [
      { amount: 1000, created_at: daysAgo(100) },
      { amount: 500, created_at: daysAgo(40) },
      { amount: 300, created_at: daysAgo(10) },
    ]
    expect(oldestUnpaidDays(300, charges, now)).toBe(10)
    expect(oldestUnpaidDays(700, charges, now)).toBe(40)
    expect(oldestUnpaidDays(1500, charges, now)).toBe(100)
    expect(oldestUnpaidDays(0, charges, now)).toBe(0)
  })

  it('debt without matching charges counts as old', () => {
    expect(oldestUnpaidDays(5000, [{ amount: 100, created_at: daysAgo(5) }], now)).toBe(365)
  })

  it('grades by age of the oldest unpaid charge', () => {
    const charge = (days: number) => [{ amount: 1000, created_at: daysAgo(days) }]
    expect(creditScore({ balance: 0, creditLimit: 0, charges: [], now }).grade).toBe('A')
    expect(creditScore({ balance: 1000, creditLimit: 0, charges: charge(20), now }).grade).toBe('A')
    expect(creditScore({ balance: 1000, creditLimit: 0, charges: charge(45), now }).grade).toBe('B')
    expect(creditScore({ balance: 1000, creditLimit: 0, charges: charge(75), now }).grade).toBe('C')
    expect(creditScore({ balance: 1000, creditLimit: 0, charges: charge(120), now }).grade).toBe('D')
  })

  it('being over the credit limit lowers one grade', () => {
    const score = creditScore({ balance: 1000, creditLimit: 800, charges: [{ amount: 1000, created_at: daysAgo(5) }], now })
    expect(score).toMatchObject({ grade: 'B', overLimit: true })
  })

  it('checks account sales against the limit (0 means no limit)', () => {
    expect(exceedsCreditLimit(500, 0, 1e9)).toBe(false)
    expect(exceedsCreditLimit(500, 1000, 500)).toBe(false)
    expect(exceedsCreditLimit(500, 1000, 500.01)).toBe(true)
  })
})

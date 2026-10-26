import { toCents } from '@/features/purchases/money'

export interface EntryAmountLine { debit: string | number; credit: string | number }

interface EntryTotals { debit: number; credit: number }

export function getEntryTotals(lines: EntryAmountLine[]) {
  return lines.reduce<EntryTotals>((totals, line) => ({
    debit: totals.debit + toCents(line.debit || 0),
    credit: totals.credit + toCents(line.credit || 0),
  }), { debit: 0, credit: 0 })
}

export function isBalancedEntry(lines: EntryAmountLine[]): boolean {
  const totals = getEntryTotals(lines)
  return totals.debit > 0 && totals.debit === totals.credit
}

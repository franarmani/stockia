import { supabase } from '@/lib/supabase'
import { syncEngine } from '@/sync/syncEngine'
import { getLocalRows } from '@/sync/storage'
import { cachedRead, callRpcOrQueue } from '@/sync/remote'
import { fromCents, toCents } from '@/features/purchases/money'
import { getEntryTotals } from './accountingValidation'

const db = supabase as any

export interface AccountingAccount { id: string; code: string; name: string; account_type: string; parent_id: string | null; level: number; postable: boolean; active: boolean; requires_accountant_validation: boolean }
export interface AccountingEntry { id: string; entry_date: string; entry_number: number; description: string; source_type: string; source_id: string | null; status: string; accounting_entry_lines: Array<{ id: string; account_id: string; debit: number; credit: number; description: string | null; account: AccountingAccount }> }

/** Estado que se muestra para los asientos cargados sin conexión hasta que el servidor los numere. */
export const PENDING_SYNC_STATUS = 'pendiente de sincronizar'

export async function listAccounts(businessId: string): Promise<AccountingAccount[]> {
  const accounts = await syncEngine.pullRows<AccountingAccount>('accounting_accounts', businessId, () =>
    db.from('accounting_accounts').select('*').eq('business_id', businessId))
  return [...accounts].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
}

export async function saveAccount(businessId: string, account: Partial<AccountingAccount> & { code: string; name: string; account_type: string }) {
  const payload = { code: account.code.trim(), name: account.name.trim(), account_type: account.account_type, parent_id: account.parent_id || null, level: account.level || 1, postable: account.postable ?? true, active: account.active ?? true, requires_accountant_validation: true, updated_at: new Date().toISOString() }
  if (account.id) await syncEngine.updateRow('accounting_accounts', businessId, account.id, payload)
  else await syncEngine.createRow('accounting_accounts', businessId, { ...payload, id: crypto.randomUUID() })
}

export async function listEntries(businessId: string, from?: string, to?: string): Promise<AccountingEntry[]> {
  const [remote, pending] = await Promise.all([
    cachedRead(`accounting_entries:${businessId}:${from ?? ''}:${to ?? ''}`, async () => {
      let query = db.from('accounting_entries').select('*, accounting_entry_lines(*, account:accounting_accounts(*))').eq('business_id', businessId).order('entry_date', { ascending: false }).order('entry_number', { ascending: false })
      if (from) query = query.gte('entry_date', from)
      if (to) query = query.lte('entry_date', to)
      const { data, error } = await query.limit(500)
      if (error) throw error
      return (data ?? []) as AccountingEntry[]
    }),
    syncEngine.getPendingRpc(businessId, 'create_manual_accounting_entry'),
  ])
  const pendingEntries = pending.map(op => ({ ...(op.payload as any).preview, id: op.operation_id }) as AccountingEntry)
  return [...pendingEntries, ...remote]
}

export async function createManualEntry(businessId: string, _userId: string, input: { date: string; description: string; lines: Array<{ accountId: string; debit: string; credit: string; description?: string }> }): Promise<string | null> {
  const { debit, credit } = getEntryTotals(input.lines)
  if (!debit || debit !== credit) throw new Error('El asiento debe estar balanceado antes de confirmarlo.')
  const lines = input.lines.map(line => ({ account_id: line.accountId, debit: fromCents(toCents(line.debit || '0')), credit: fromCents(toCents(line.credit || '0')), description: line.description || null }))
  const accounts = await getLocalRows<AccountingAccount>('accounting_accounts', businessId)

  return callRpcOrQueue<string>({
    business_id: businessId,
    rpc: 'create_manual_accounting_entry',
    args: { p_entry: { date: input.date, description: input.description }, p_lines: lines },
    label: `Asiento: ${input.description}`,
    tables: ['accounting_entries'],
    dedupe: { table: 'accounting_entries', match: { description: input.description, entry_date: input.date, source_type: 'MANUAL' } },
    preview: {
      entry_date: input.date,
      entry_number: 0,
      description: input.description,
      source_type: 'MANUAL',
      source_id: null,
      status: PENDING_SYNC_STATUS,
      accounting_entry_lines: lines.map(line => ({
        ...line,
        id: crypto.randomUUID(),
        debit: Number(line.debit),
        credit: Number(line.credit),
        account: accounts.find(account => account.id === line.account_id) ?? null,
      })),
    },
  })
}

export async function reverseEntry(businessId: string, entryId: string, reason: string): Promise<string | null> {
  return callRpcOrQueue<string>({
    business_id: businessId,
    rpc: 'reverse_accounting_entry',
    args: { p_entry_id: entryId, p_reason: reason },
    label: 'Reversión de asiento',
    tables: ['accounting_entries'],
    dedupe: { table: 'accounting_entries', match: { reversal_of_id: entryId } },
  })
}

export async function listLedger(businessId: string, accountId: string, from: string, to: string) {
  return cachedRead(`general_ledger:${accountId}:${from}:${to}`, async () => {
    const { data, error } = await db.from('general_ledger').select('*').eq('business_id', businessId).eq('account_id', accountId).gte('entry_date', from).lte('entry_date', to).order('entry_date').order('entry_number')
    if (error) throw error
    return data ?? []
  })
}

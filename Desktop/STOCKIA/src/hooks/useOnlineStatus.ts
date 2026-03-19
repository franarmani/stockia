import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getPendingSales, removePendingSale, getPendingCount } from '@/lib/offlineQueue'
import { toast } from 'sonner'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncLock = useRef(false)

  // Track online/offline
  useEffect(() => {
    const goOnline = () => { setIsOnline(true) }
    const goOffline = () => { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Refresh pending count periodically
  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 10000)
    return () => clearInterval(interval)
  }, [])

  async function refreshCount() {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch { /* ignore */ }
  }

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPendingSales()
    }
  }, [isOnline])

  const syncPendingSales = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return
    syncLock.current = true
    setSyncing(true)

    try {
      const sales = await getPendingSales()
      let synced = 0

      for (const offlineSale of sales) {
        try {
          const p = offlineSale.payload

          // 1. Create sale
          const { data: sale, error: saleErr } = await supabase
            .from('sales')
            .insert(p.sale)
            .select()
            .single()

          if (saleErr || !sale) {
            console.error('Sync sale error:', saleErr)
            continue
          }

          // 2. Sale items (update sale_id)
          const items = p.items.map(item => ({ ...item, sale_id: sale.id }))
          await supabase.from('sale_items').insert(items)

          // 3. Payment splits
          const payments = p.payments.map(pay => ({ ...pay, sale_id: sale.id }))
          await supabase.from('sale_payments').insert(payments)

          // 4. Stock updates
          for (const su of p.stockUpdates) {
            await supabase.from('products').update({ stock: Math.max(0, su.newStock) }).eq('id', su.productId)
            await supabase.from('stock_movements').insert({
              business_id: p.sale.business_id,
              product_id: su.productId,
              type: 'sale',
              quantity: -su.qty,
              reference_id: sale.id,
            })
          }

          // 5. Customer balance (if account payment)
          if (p.accountUpdate) {
            const { data: cust } = await supabase.from('customers').select('balance').eq('id', p.accountUpdate.customerId).single()
            if (cust) {
              await supabase.from('customers').update({
                balance: cust.balance + p.accountUpdate.amount,
              }).eq('id', p.accountUpdate.customerId)
            }
          }

          // Success — remove from queue
          await removePendingSale(offlineSale.id)
          synced++
        } catch (err) {
          console.error('Sync error for sale:', offlineSale.id, err)
        }
      }

      if (synced > 0) {
        toast.success(`${synced} venta${synced > 1 ? 's' : ''} sincronizada${synced > 1 ? 's' : ''}`)
      }
      await refreshCount()
    } catch (err) {
      console.error('Sync batch error:', err)
    } finally {
      setSyncing(false)
      syncLock.current = false
    }
  }, [])

  return { isOnline, pendingCount, syncing, syncPendingSales, syncNow: syncPendingSales, refreshCount }
}

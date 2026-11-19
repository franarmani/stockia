/**
 * CajaGo — Supabase Realtime Subscriptions
 * Keeps multi-device installations (Caja Principal, Mostrador, Oficina)
 * updated in real-time without aggressive polling.
 */

import { supabase } from '@/lib/supabase'
import { syncEngine } from './syncEngine'
import { isOnline } from './connectivity'

type RealtimeCallback = (payload: any) => void

class RealtimeManager {
  private channel: any = null
  private businessId: string | null = null
  private saleListeners: Set<RealtimeCallback> = new Set()
  private stockListeners: Set<RealtimeCallback> = new Set()
  private productsPullTimeout: any = null

  private scheduleProductsPull(businessId: string) {
    if (this.productsPullTimeout) clearTimeout(this.productsPullTimeout)
    this.productsPullTimeout = setTimeout(() => {
      this.productsPullTimeout = null
      if (isOnline()) {
        syncEngine.pullLatestProducts(businessId, { forceRemote: true }).catch((err) => {
          console.warn('[CajaGo Realtime] Error actualizando productos:', err)
        })
      }
    }, 300)
  }

  public init(businessId: string) {
    if (this.businessId === businessId && this.channel) {
      return
    }

    this.businessId = businessId

    // Remove existing channel if any
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }

    // Subscribe to postgres_changes on sales and products for this business
    this.channel = supabase
      .channel(`cajago_business_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          this.saleListeners.forEach((fn) => fn(payload))
          syncEngine.notifyDataUpdated()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          this.stockListeners.forEach((fn) => fn(payload))
          this.scheduleProductsPull(businessId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          this.scheduleProductsPull(businessId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          if (isOnline()) {
            syncEngine.pullRows('categories', businessId, () =>
              supabase.from('categories').select('*').eq('business_id', businessId),
              { forceRemote: true }
            ).catch(() => {})
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          if (isOnline()) {
            syncEngine.pullLatestCustomers(businessId, { forceRemote: true }).catch(() => {})
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[CajaGo Realtime] Conectado en vivo para negocio ${businessId}`)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[CajaGo Realtime] Estado canal: ${status}, reconectando en 5s...`)
          setTimeout(() => {
            if (this.businessId === businessId) {
              this.init(businessId)
            }
          }, 5000)
        }
      })
  }

  public onSale(callback: RealtimeCallback): () => void {
    this.saleListeners.add(callback)
    return () => this.saleListeners.delete(callback)
  }

  public onStockChange(callback: RealtimeCallback): () => void {
    this.stockListeners.add(callback)
    return () => this.stockListeners.delete(callback)
  }

  public cleanup() {
    if (this.productsPullTimeout) {
      clearTimeout(this.productsPullTimeout)
      this.productsPullTimeout = null
    }
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
      this.businessId = null
    }
  }
}

export const realtimeManager = new RealtimeManager()

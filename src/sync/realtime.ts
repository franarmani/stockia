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

  public init(businessId: string) {
    if (this.businessId === businessId && this.channel) {
      return
    }

    this.businessId = businessId

    // Remove existing channel if any
    if (this.channel) {
      supabase.removeChannel(this.channel)
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
          // Automatically refresh local products snapshot
          if (isOnline()) {
            syncEngine.pullLatestProducts(businessId, { forceRemote: true })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[CajaGo Realtime] Conectado a canal para negocio ${businessId}`)
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
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
      this.businessId = null
    }
  }
}

export const realtimeManager = new RealtimeManager()

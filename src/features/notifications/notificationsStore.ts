import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/database'

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  lastFetched: number | null
  fetch: (businessId: string, force?: boolean) => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: (businessId: string) => Promise<void>
  generate: (businessId: string) => Promise<void>
  clear: () => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  lastFetched: null,

  fetch: async (businessId: string, force = false) => {
    const { lastFetched } = get()
    // Cache for 3 minutes unless forced
    if (!force && lastFetched && Date.now() - lastFetched < 3 * 60 * 1000) return

    set({ loading: true })
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      const items = data as AppNotification[]
      set({
        notifications: items,
        unreadCount: items.filter(n => !n.is_read).length,
        lastFetched: Date.now(),
      })
    }
    set({ loading: false })
  },

  markRead: async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  markAllRead: async (businessId: string) => {
    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('business_id', businessId)
      .eq('is_read', false)
    
    if (error) {
      console.error('[Notifications] Error marking all as read:', error)
      return
    }

    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },

  generate: async (businessId: string) => {
    await supabase.rpc('generate_notifications', { p_business_id: businessId })
    await get().fetch(businessId, true)
  },

  clear: () => set({ notifications: [], unreadCount: 0, lastFetched: null }),
}))

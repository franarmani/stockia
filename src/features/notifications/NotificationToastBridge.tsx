import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useBusinessStore } from '@/stores/businessStore'
import { useNotificationsStore } from './notificationsStore'
import type { AppNotification } from '@/types/database'

function showNotificationToast(notification: AppNotification, navigate: ReturnType<typeof useNavigate>) {
  const options = {
    description: notification.message,
    duration: notification.severity === 'danger' ? 9000 : 6500,
    action: notification.action_url
      ? { label: 'Ver', onClick: () => navigate(notification.action_url!) }
      : undefined,
  }

  if (notification.severity === 'danger') {
    toast.error(notification.title, options)
    return
  }

  if (notification.severity === 'warn') {
    toast.warning(notification.title, options)
    return
  }

  toast.info(notification.title, options)
}

export default function NotificationToastBridge() {
  const { business } = useBusinessStore()
  const { notifications, startPolling, stopPolling } = useNotificationsStore()
  const navigate = useNavigate()
  const initialized = useRef(false)
  const knownIds = useRef(new Set<string>())

  useEffect(() => {
    initialized.current = false
    knownIds.current.clear()

    if (!business?.id) return

    startPolling(business.id)
    return () => stopPolling()
  }, [business?.id, startPolling, stopPolling])

  useEffect(() => {
    const unread = notifications.filter(notification => !notification.is_read)

    if (!initialized.current) {
      unread.forEach(notification => knownIds.current.add(notification.id))
      initialized.current = true
      return
    }

    const newNotifications = unread.filter(notification => !knownIds.current.has(notification.id))
    unread.forEach(notification => knownIds.current.add(notification.id))

    if (newNotifications.length === 1) {
      showNotificationToast(newNotifications[0], navigate)
    } else if (newNotifications.length > 1) {
      toast.info(`${newNotifications.length} alertas nuevas`, {
        description: 'Revisá el centro de notificaciones para ver el detalle.',
        action: { label: 'Ver todas', onClick: () => navigate('/notifications') },
      })
    }
  }, [navigate, notifications])

  return null
}

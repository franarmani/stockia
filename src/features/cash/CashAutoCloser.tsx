import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { runCashAutoClose } from './autoClose'

/** Revisa cada minuto si toca el cierre automático de caja configurado en el negocio. */
export default function CashAutoCloser() {
  const { profile } = useAuthStore()
  const time = (useBusinessStore((s) => s.business) as any)?.cash_auto_close_time as string | null | undefined

  useEffect(() => {
    if (!profile?.business_id || !time) return
    let running = false
    const check = async () => {
      if (running) return
      running = true
      try {
        if (await runCashAutoClose(profile.business_id, profile.id, time)) {
          toast.info(`La caja se cerró automáticamente (${time}).`)
        }
      } catch (error) {
        console.warn('[CashAutoClose] failed:', error)
      } finally {
        running = false
      }
    }
    check()
    const timer = setInterval(check, 60_000)
    return () => clearInterval(timer)
  }, [profile?.business_id, profile?.id, time])

  return null
}

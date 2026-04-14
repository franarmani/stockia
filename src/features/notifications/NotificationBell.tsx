import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsStore } from './notificationsStore'
import { useBusinessStore } from '@/stores/businessStore'
import type { AppNotification } from '@/types/database'

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/15 border-blue-500/25',
  warn: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
  danger: 'text-red-400 bg-red-500/15 border-red-500/25',
}

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-blue-400',
  warn: 'bg-amber-400',
  danger: 'bg-red-500',
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function NotificationBell() {
  const { business } = useBusinessStore()
  const { notifications, unreadCount, fetch, markRead, markAllRead, generate } = useNotificationsStore()
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (business?.id) {
      fetch(business.id)
      // Auto-generate every 10 minutes
      generate(business.id)
      const interval = setInterval(() => generate(business.id!), 10 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [business?.id])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id)
    if (n.action_url) navigate(n.action_url)
    setOpen(false)
  }

  const recent = notifications.slice(0, 8)

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/10 transition text-white/70 hover:text-white"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-slate-950 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-[13px] font-semibold text-white">Notificaciones</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => business?.id && markAllRead(business.id)}
                  className="text-[11px] text-white/50 hover:text-white transition flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Leer todas
                </button>
              )}
              <button
                onClick={() => { navigate('/notifications'); setOpen(false) }}
                className="text-[11px] text-primary hover:text-primary/80 transition"
              >
                Ver todas
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-[12px] text-white/40">Sin notificaciones</p>
              </div>
            ) : (
              recent.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition flex items-start gap-3 ${!n.is_read ? 'bg-white/3' : ''}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-white/15' : SEVERITY_DOT[n.severity]}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-medium leading-tight ${n.is_read ? 'text-white/60' : 'text-white'}`}>{n.title}</p>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-tight line-clamp-2">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <span className="text-[10px] text-white/30">{timeAgo(n.created_at)}</span>
                    {n.action_url && <ExternalLink className="w-3 h-3 text-white/20" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

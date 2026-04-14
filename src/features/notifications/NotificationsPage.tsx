import { useEffect, useState } from 'react'
import { Bell, CheckCheck, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsStore } from './notificationsStore'
import { useBusinessStore } from '@/stores/businessStore'
import type { NotificationSeverity } from '@/types/database'

const SEVERITY_STYLE: Record<NotificationSeverity, string> = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  danger: 'text-red-400 bg-red-500/10 border-red-500/20',
}
const SEVERITY_ICON = {
  info: Info,
  warn: AlertTriangle,
  danger: AlertCircle,
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export default function NotificationsPage() {
  const { business } = useBusinessStore()
  const { notifications, loading, fetch, markRead, markAllRead, generate } = useNotificationsStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<NotificationSeverity | 'all'>('all')

  useEffect(() => {
    if (business?.id) {
      fetch(business.id, true)
    }
  }, [business?.id])

  const filtered = filter === 'all'
    ? notifications.filter(n => !n.is_read)
    : notifications.filter(n => n.severity === filter && !n.is_read)

  const unread = notifications.filter(n => !n.is_read).length
  const hasHistory = notifications.some(n => n.is_read)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Notificaciones</h1>
            {unread > 0 && <p className="text-[12px] text-white/50">{unread} sin leer</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={() => business?.id && markAllRead(business.id)}
              className="glass-btn flex items-center gap-1.5 text-[12px]"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Leer todas
            </button>
          )}
          <button
            onClick={() => business?.id && generate(business.id)}
            className="glass-btn text-[12px]"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'danger', 'warn', 'info'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition border ${
              filter === f
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'danger' ? 'Crítico' : f === 'warn' ? 'Advertencia' : 'Info'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="glass-card divide-y divide-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/10 rounded w-1/2" />
                <div className="h-3 bg-white/10 rounded w-3/4" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-12 h-12 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-[14px]">Sin notificaciones{filter !== 'all' ? ' en este filtro' : ''}</p>
          </div>
        ) : (
          filtered.map(n => {
            const Icon = SEVERITY_ICON[n.severity]
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/5 transition bg-white/[0.03]"
                onClick={() => {
                  if (!n.is_read) markRead(n.id)
                  if (n.action_url) navigate(n.action_url)
                }}
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${SEVERITY_STYLE[n.severity]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold leading-tight text-white">
                      {n.title}
                    </p>
                    <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-white/50 mt-0.5 leading-relaxed">{n.message}</p>
                  {n.action_url && (
                    <p className="text-[11px] text-primary mt-1">Ver más →</p>
                  )}
                </div>
                <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
              </div>
            )
          })
        )}
      </div>

      {hasHistory && (
        <div className="p-4 text-center">
          <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">Hay notificaciones leídas ocultas</p>
        </div>
      )}
    </div>
  )
}

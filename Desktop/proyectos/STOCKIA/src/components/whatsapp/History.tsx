/**
 * History — message log viewer per customer.
 */
import { formatDateTime } from '@/lib/utils'
import type { WaMessageLog } from '@/lib/whatsapp'
import {
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Send,
  Repeat,
} from 'lucide-react'

interface Props {
  logs: WaMessageLog[]
  onResend: (log: WaMessageLog) => void
  onMarkSent: (logId: string) => void
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  opened: { label: 'Abierto', icon: ExternalLink, color: 'text-blue-400 bg-blue-500/15' },
  copied: { label: 'Copiado', icon: Copy, color: 'text-amber-400 bg-amber-500/15' },
  sent: { label: 'Enviado', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/15' },
}

const CONTEXT_LABELS: Record<string, string> = {
  sale: 'Venta',
  invoice: 'Factura',
  account: 'Cuenta',
  summary: 'Resumen',
  catalog: 'Catálogo',
  manual: 'Manual',
}

export default function History({ logs, onResend, onMarkSent }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <Clock className="w-10 h-10 text-white/15 mb-3" />
        <p className="text-sm text-white/30">Sin mensajes enviados aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 p-2">
      {logs.map((log) => {
        const meta = STATUS_META[log.status] || STATUS_META.opened
        return (
          <div
            key={log.id}
            className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-start gap-2">
              {/* Status badge */}
              <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${meta.color}`}>
                <meta.icon className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-white/40">
                    {formatDateTime(log.created_at)}
                  </span>
                  {log.context_type && (
                    <span className="text-[9px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded">
                      {CONTEXT_LABELS[log.context_type] || log.context_type}
                    </span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                {/* Message preview */}
                <p className="text-xs text-white/60 line-clamp-2">{log.message_final}</p>

                {/* Phone */}
                <p className="text-[10px] text-white/25 mt-1">{log.customer_phone}</p>
              </div>

              {/* Actions */}
              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onResend(log)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                  title="Reenviar"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
                {log.status !== 'sent' && (
                  <button
                    onClick={() => onMarkSent(log.id)}
                    className="p-1.5 rounded-md hover:bg-emerald-500/15 text-white/30 hover:text-emerald-400 transition-colors"
                    title="Marcar como enviado"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

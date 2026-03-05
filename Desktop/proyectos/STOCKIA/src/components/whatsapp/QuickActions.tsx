/**
 * QuickActions — right panel with one-click WhatsApp actions.
 */
import {
  Receipt,
  FileText,
  DollarSign,
  CalendarDays,
  ShoppingBag,
  BarChart3,
  ChevronRight,
  Repeat,
} from 'lucide-react'

interface Props {
  onSendTicket: () => void
  onSendInvoice: () => void
  onSendPaymentReminder: () => void
  onSendDailySummary: () => void
  onSendCatalog: () => void
  onSendStatement: () => void
  onResendLast?: () => void
  hasCustomer: boolean
}

const ACTIONS = [
  {
    key: 'ticket',
    label: 'Enviar ticket última venta',
    desc: 'Genera link público y abre WhatsApp',
    icon: Receipt,
    color: 'text-blue-400 bg-blue-500/15',
    handler: 'onSendTicket' as const,
  },
  {
    key: 'invoice',
    label: 'Enviar última factura',
    desc: 'Link al PDF de la factura',
    icon: FileText,
    color: 'text-indigo-400 bg-indigo-500/15',
    handler: 'onSendInvoice' as const,
  },
  {
    key: 'payment',
    label: 'Recordatorio de deuda',
    desc: 'Con saldo y estado de cuenta',
    icon: DollarSign,
    color: 'text-amber-400 bg-amber-500/15',
    handler: 'onSendPaymentReminder' as const,
  },
  {
    key: 'statement',
    label: 'Enviar estado de cuenta',
    desc: 'Link público con movimientos',
    icon: BarChart3,
    color: 'text-teal-400 bg-teal-500/15',
    handler: 'onSendStatement' as const,
  },
  {
    key: 'catalog',
    label: 'Enviar catálogo rápido',
    desc: 'Top productos con precios',
    icon: ShoppingBag,
    color: 'text-pink-400 bg-pink-500/15',
    handler: 'onSendCatalog' as const,
  },
  {
    key: 'summary',
    label: 'Enviar resumen diario',
    desc: 'Ventas y métricas del día',
    icon: CalendarDays,
    color: 'text-purple-400 bg-purple-500/15',
    handler: 'onSendDailySummary' as const,
  },
]

export default function QuickActions(props: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[11px] text-white/35 font-semibold uppercase tracking-wider">
          Acciones rápidas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {ACTIONS.map((action) => {
          const needsCustomer = ['ticket', 'invoice', 'payment', 'statement'].includes(action.key)
          const disabled = needsCustomer && !props.hasCustomer

          return (
            <button
              key={action.key}
              onClick={props[action.handler]}
              disabled={disabled}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group ${
                disabled
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-white/5 active:scale-[0.98]'
              } border border-transparent hover:border-white/10`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}
              >
                <action.icon className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{action.label}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{action.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
            </button>
          )
        })}

        {/* Resend last */}
        {props.onResendLast && (
          <>
            <div className="border-t border-white/5 my-2" />
            <button
              onClick={props.onResendLast}
              disabled={!props.hasCustomer}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group ${
                !props.hasCustomer ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5'
              } border border-transparent hover:border-white/10`}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-emerald-400 bg-emerald-500/15">
                <Repeat className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Reenviar último mensaje</p>
                <p className="text-[10px] text-white/35 mt-0.5">Abre el chat con el último texto</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
            </button>
          </>
        )}
      </div>

      {!props.hasCustomer && (
        <div className="px-4 py-3 border-t border-white/5 text-[10px] text-white/25 text-center">
          Seleccioná un cliente para usar acciones rápidas
        </div>
      )}
    </div>
  )
}

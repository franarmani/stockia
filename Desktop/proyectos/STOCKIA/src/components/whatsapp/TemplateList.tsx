/**
 * TemplateList — template selector with categories.
 */
import type { WaTemplate } from '@/lib/whatsapp'
import {
  MessageCircle,
  FileText,
  DollarSign,
  Megaphone,
  HelpCircle,
  Send,
} from 'lucide-react'

interface Props {
  templates: WaTemplate[]
  selectedId: string | null
  onSelect: (t: WaTemplate) => void
}

const CATEGORY_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  sales: { label: 'Ventas', icon: MessageCircle, color: 'text-blue-400' },
  billing: { label: 'Facturación', icon: FileText, color: 'text-indigo-400' },
  accounts: { label: 'Cuentas', icon: DollarSign, color: 'text-amber-400' },
  marketing: { label: 'Marketing', icon: Megaphone, color: 'text-pink-400' },
  support: { label: 'Soporte', icon: HelpCircle, color: 'text-cyan-400' },
}

export default function TemplateList({ templates, selectedId, onSelect }: Props) {
  // Group by category
  const grouped = templates.reduce<Record<string, WaTemplate[]>>((acc, t) => {
    ;(acc[t.category] ??= []).push(t)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([cat, items]) => {
        const meta = CATEGORY_META[cat] || { label: cat, icon: Send, color: 'text-white/50' }
        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <meta.icon className={`w-3 h-3 ${meta.color}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {meta.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    selectedId === t.id
                      ? 'bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30'
                      : 'text-white/60 hover:bg-white/5 border border-transparent hover:text-white/80'
                  }`}
                >
                  <span className="font-medium">{t.name}</span>
                  <p className="text-[10px] text-white/30 mt-0.5 line-clamp-1">{t.message}</p>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {templates.length === 0 && (
        <div className="text-center py-8 text-sm text-white/30">
          No hay plantillas configuradas
        </div>
      )}
    </div>
  )
}

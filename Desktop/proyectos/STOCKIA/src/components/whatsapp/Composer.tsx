/**
 * Composer — the main message editing panel with variable chips,
 * smart blocks (greeting/signature/attachments), and preview.
 */
import { useState, useCallback, useMemo, useRef } from 'react'
import { VARIABLE_GROUPS, renderTemplate } from '@/lib/whatsapp/templateEngine'
import type { TemplateContext } from '@/lib/whatsapp/templateEngine'
import {
  Copy,
  Check,
  ExternalLink,
  Send,
  Link2,
  ToggleLeft,
  ToggleRight,
  FileText,
  Receipt,
  BarChart3,
  ShoppingBag,
} from 'lucide-react'

interface Props {
  message: string
  onChange: (msg: string) => void
  context: TemplateContext
  signature: string
  greeting: string
  onSend: () => void
  onCopy: () => void
  onCopyLink: () => void
  sendDisabled?: boolean
  /** Attachment toggles */
  onAttachTicket?: () => void
  onAttachInvoice?: () => void
  onAttachStatement?: () => void
  onAttachCatalog?: () => void
}

export default function Composer({
  message,
  onChange,
  context,
  signature,
  greeting,
  onSend,
  onCopy,
  onCopyLink,
  sendDisabled,
  onAttachTicket,
  onAttachInvoice,
  onAttachStatement,
  onAttachCatalog,
}: Props) {
  const [showGreeting, setShowGreeting] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Build final message with toggleable blocks
  const fullMessage = useMemo(() => {
    let msg = ''
    if (showGreeting && greeting) msg += `${greeting} {{customer.name}}!\n\n`
    msg += message
    if (showSignature && signature) msg += `\n\n${signature}`
    return msg
  }, [message, showGreeting, showSignature, greeting, signature])

  // Render preview
  const preview = useMemo(() => {
    return renderTemplate(fullMessage, context)
  }, [fullMessage, context])

  // Insert variable at cursor
  const insertVar = useCallback(
    (key: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = message.slice(0, start)
      const after = message.slice(end)
      const newMsg = `${before}{{${key}}}${after}`
      onChange(newMsg)
      requestAnimationFrame(() => {
        const pos = start + key.length + 4
        ta.setSelectionRange(pos, pos)
        ta.focus()
      })
    },
    [message, onChange]
  )

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Smart Blocks Bar */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-3 flex-wrap">
        {/* Greeting toggle */}
        <button
          onClick={() => setShowGreeting(!showGreeting)}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white/40 hover:text-white/70 transition-colors"
        >
          {showGreeting ? (
            <ToggleRight className="w-4 h-4 text-[#25D366]" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          Saludo
        </button>

        {/* Signature toggle */}
        <button
          onClick={() => setShowSignature(!showSignature)}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white/40 hover:text-white/70 transition-colors"
        >
          {showSignature ? (
            <ToggleRight className="w-4 h-4 text-[#25D366]" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          Firma
        </button>

        <div className="w-px h-4 bg-white/10" />

        {/* Attachment buttons */}
        {onAttachTicket && (
          <button
            onClick={onAttachTicket}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-blue-400 transition-colors"
            title="Adjuntar ticket"
          >
            <Receipt className="w-3.5 h-3.5" />
            Ticket
          </button>
        )}
        {onAttachInvoice && (
          <button
            onClick={onAttachInvoice}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-indigo-400 transition-colors"
            title="Adjuntar factura"
          >
            <FileText className="w-3.5 h-3.5" />
            Factura
          </button>
        )}
        {onAttachStatement && (
          <button
            onClick={onAttachStatement}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-amber-400 transition-colors"
            title="Adjuntar estado de cuenta"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Cuenta
          </button>
        )}
        {onAttachCatalog && (
          <button
            onClick={onAttachCatalog}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-pink-400 transition-colors"
            title="Adjuntar catálogo"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Catálogo
          </button>
        )}
      </div>

      {/* Variable Chips */}
      <div className="px-4 py-2 border-b border-white/5 max-h-28 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-1">
              <span className="text-[9px] text-white/25 font-semibold uppercase mr-0.5">
                {group.label}:
              </span>
              {group.vars.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVar(v.key)}
                  className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/50 hover:bg-[#25D366]/15 hover:text-[#25D366] hover:border-[#25D366]/30 transition-all"
                  title={`{{${v.key}}} — ej: ${v.example}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-4 flex flex-col min-h-0 gap-3">
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-1.5">
            Editor
          </p>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escribí tu mensaje… Usá {{variables}} o los chips de arriba"
            className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-[#25D366]/50 min-h-20"
          />
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">
              Vista previa
            </p>
            {preview.missingVars.length > 0 && (
              <span className="text-[9px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">
                {preview.missingVars.length} variable{preview.missingVars.length > 1 ? 's' : ''} sin datos
              </span>
            )}
          </div>
          <div className="flex-1 bg-[#0b141a] border border-white/5 rounded-xl p-3 text-sm text-[#e9edef] overflow-y-auto whitespace-pre-wrap font-[system-ui] min-h-20">
            {preview.result || <span className="text-white/20 italic">El mensaje aparecerá aquí…</span>}
          </div>
          <p className="text-[10px] text-white/20 text-right mt-1">
            {preview.result.length} caracteres
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg"
          title="Copiar mensaje"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          Copiar
        </button>

        <button
          onClick={onCopyLink}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg"
          title="Copiar link wa.me"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Link</span>
        </button>

        <button
          onClick={onSend}
          disabled={sendDisabled}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1fb855] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all active:scale-[0.98]"
        >
          <Send className="w-4 h-4" />
          Abrir WhatsApp
        </button>
      </div>
    </div>
  )
}

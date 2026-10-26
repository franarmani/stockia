import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bot, CheckCircle2, Loader2, MessageCircle, Pause, Play, QrCode, Send, Unplug, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isOnline } from '@/sync/connectivity'
import { cn } from '@/lib/utils'

// WhatsApp con IA: el comercio conecta su propio número escaneando un QR (CajaGo le crea la instancia
// en Z-API como partner). Todo pasa por la función whatsapp; los tokens nunca llegan a la app.

interface Config { has_credentials: boolean; managed: boolean; bot_enabled: boolean; bot_instructions: string; connected: boolean | null }
interface Chat { phone: string; contact_name: string | null; bot_paused_until: string | null; needs_human: boolean; unread: number; last_message_at: string | null }
interface Message { id: string; phone: string; direction: 'in' | 'out'; author: string | null; body: string; created_at: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp', { body })
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'No se pudo conectar con WhatsApp')
  }
  return data as T
}

const card = 'rounded-2xl border border-white/8 bg-[#0d1b2d] p-5'
const button = 'h-9 px-4 rounded-lg text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5'

export default function WhatsAppPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [bot, setBot] = useState({ enabled: false, instructions: '' })
  const [saving, setSaving] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadConfig() {
    if (!isOnline()) { setLoading(false); return }
    try {
      const data = await call<Config>({ action: 'get_config' })
      setConfig(data)
      setBot({ enabled: data.bot_enabled, instructions: data.bot_instructions ?? '' })
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadChats() {
    if (!profile?.business_id) return
    const { data } = await (supabase as any).from('whatsapp_chats').select('*').eq('business_id', profile.business_id)
      .order('last_message_at', { ascending: false, nullsFirst: false }).limit(100)
    setChats(data ?? [])
  }

  async function loadMessages(phone: string) {
    if (!profile?.business_id) return
    const { data } = await (supabase as any).from('whatsapp_messages').select('*').eq('business_id', profile.business_id).eq('phone', phone)
      .order('created_at', { ascending: true }).limit(300)
    setMessages(data ?? [])
  }

  useEffect(() => {
    loadConfig()
    return () => { if (qrTimer.current) clearInterval(qrTimer.current) }
  }, [])

  useEffect(() => {
    if (!config?.connected) return
    loadChats()
    const timer = setInterval(() => { loadChats(); if (selected) loadMessages(selected) }, 10000)
    return () => clearInterval(timer)
  }, [config?.connected, selected])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected)
    call({ action: 'mark_read', phone: selected }).catch(() => {})
  }, [selected])

  // Mientras se espera el escaneo, el QR se renueva solo y se detecta la conexión.
  function startQrPolling() {
    if (qrTimer.current) clearInterval(qrTimer.current)
    const tick = async () => {
      try {
        const result = await call<{ connected: boolean; qr: string | null }>({ action: 'qr' })
        if (result.connected) {
          if (qrTimer.current) clearInterval(qrTimer.current)
          qrTimer.current = null
          setQr(null)
          toast.success('WhatsApp conectado')
          loadConfig()
          return
        }
        setQr(result.qr ? (result.qr.startsWith('data:') ? result.qr : `data:image/png;base64,${result.qr}`) : null)
      } catch {}
    }
    tick()
    qrTimer.current = setInterval(tick, 4000)
  }

  async function connect() {
    setConnecting(true)
    try {
      await call({ action: 'connect' })
      startQrPolling()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar el WhatsApp del negocio? El asistente deja de responder.')) return
    try {
      await call({ action: 'disconnect' })
      toast.success('WhatsApp desconectado')
      setChats([]); setSelected(null)
      loadConfig()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function saveBot() {
    setSaving(true)
    try {
      await call({ action: 'save_config', bot_enabled: bot.enabled, bot_instructions: bot.instructions })
      toast.success('Asistente guardado')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !reply.trim()) return
    setSending(true)
    try {
      await call({ action: 'send', phone: selected, message: reply.trim() })
      setReply('')
      loadMessages(selected)
      loadChats()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSending(false)
    }
  }

  async function toggleBot(chat: Chat) {
    const paused = !!chat.bot_paused_until && new Date(chat.bot_paused_until) > new Date()
    try {
      await call({ action: paused ? 'resume' : 'pause', phone: chat.phone })
      loadChats()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const connected = !!config?.connected
  const current = chats.find(chat => chat.phone === selected) ?? null
  const currentPaused = !!current?.bot_paused_until && new Date(current.bot_paused_until) > new Date()

  return (
    <div className="animate-fade-in mx-auto w-full max-w-6xl space-y-6 pb-10">
      <div>
        <h1 className="cg-title">WhatsApp con IA</h1>
        <p className="mt-1 text-sm text-white/45">Conectá el WhatsApp de tu negocio: el asistente responde precios, stock y toma pedidos, y vos atendés cuando hace falta.</p>
      </div>

      {loading ? (
        <div className={card}><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : !isOnline() ? (
        <div className={card}><p className="text-sm text-white/50">WhatsApp necesita conexión a internet.</p></div>
      ) : !connected ? (
        <div className={cn(card, 'grid gap-6 md:grid-cols-[1fr_auto] md:items-center')}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><QrCode className="h-5 w-5" /></div>
              <p className="font-semibold text-white">Conectá el WhatsApp de tu negocio</p>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-white/60">
              <li>Tocá "Conectar WhatsApp" y esperá el código QR.</li>
              <li>En el celular del negocio abrí WhatsApp → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b>.</li>
              <li>Escaneá el QR. Tu WhatsApp sigue funcionando normal en el celular.</li>
            </ol>
            {isAdmin ? (
              <button onClick={connect} disabled={connecting || !!qrTimer.current} className={`${button} bg-emerald-600 text-white hover:bg-emerald-500`}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Conectar WhatsApp
              </button>
            ) : <p className="text-[13px] text-white/40">Pedile a un administrador que conecte el WhatsApp.</p>}
          </div>
          {(qr || qrTimer.current) && (
            <div className="grid h-56 w-56 place-items-center rounded-2xl bg-white p-3 justify-self-center">
              {qr ? <img src={qr} alt="Código QR para vincular WhatsApp" className="h-full w-full" /> : <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={cn(card, 'flex flex-wrap items-center justify-between gap-3')}>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="font-semibold text-white">WhatsApp conectado</p>
            </div>
            {isAdmin && <button onClick={disconnect} className={`${button} text-red-300/80 hover:bg-red-500/10`}><Unplug className="h-4 w-4" /> Desconectar</button>}
          </div>

          <div className={cn(card, 'space-y-3')}>
            <label className="flex items-center gap-2.5 text-sm text-white">
              <input type="checkbox" checked={bot.enabled} onChange={e => setBot({ ...bot, enabled: e.target.checked })} disabled={!isAdmin} />
              <Bot className="h-4 w-4 text-[#9aa9ff]" /> Asistente automático activado
            </label>
            <textarea value={bot.instructions} onChange={e => setBot({ ...bot, instructions: e.target.value })} disabled={!isAdmin} rows={3} maxLength={3000}
              placeholder="Indicaciones para el asistente: horarios, formas de pago, si hacen envíos, cómo saludar…"
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40" />
            {isAdmin && (
              <button onClick={saveBot} disabled={saving} className={`${button} bg-[#6178ee] text-white hover:bg-[#6f8cff]`}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar asistente
              </button>
            )}
          </div>

          <div className={cn(card, 'grid min-h-[28rem] gap-0 p-0 md:grid-cols-[18rem_1fr] overflow-hidden')}>
            <div className="border-b border-white/[0.06] md:border-b-0 md:border-r max-h-[28rem] overflow-y-auto">
              {chats.length === 0 ? (
                <p className="p-5 text-sm text-white/40">Todavía no hay conversaciones.</p>
              ) : chats.map(chat => (
                <button key={chat.phone} onClick={() => setSelected(chat.phone)}
                  className={cn('flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.03]', selected === chat.phone && 'bg-white/[0.05]')}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/50"><UserRound className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{chat.contact_name || `+${chat.phone}`}</p>
                    <p className="text-[11px] text-white/35">{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString('es-AR') : ''}</p>
                  </div>
                  {chat.needs_human && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">Atender</span>}
                  {chat.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white">{chat.unread}</span>}
                </button>
              ))}
            </div>

            <div className="flex min-h-[20rem] flex-col">
              {!current ? (
                <p className="m-auto text-sm text-white/40">Elegí una conversación.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                    <p className="text-sm font-semibold text-white">{current.contact_name || `+${current.phone}`}</p>
                    <button onClick={() => toggleBot(current)} className={`${button} h-8 px-3 bg-white/5 text-white/70 hover:bg-white/10`}>
                      {currentPaused ? <><Play className="h-3.5 w-3.5" /> Reactivar asistente</> : <><Pause className="h-3.5 w-3.5" /> Pausar asistente</>}
                    </button>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 max-h-[22rem]">
                    {messages.map(message => (
                      <div key={message.id} className={cn('flex', message.direction === 'out' ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-[13px] leading-5',
                          message.direction === 'out' ? 'bg-[#6178ee]/25 text-white' : 'bg-white/[0.06] text-white/85')}>
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p className="mt-0.5 text-right text-[10px] text-white/35">
                            {message.direction === 'out' && message.author === 'bot' ? 'Asistente · ' : ''}{new Date(message.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={send} className="flex gap-2 border-t border-white/[0.06] p-3">
                    <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Escribí una respuesta (pausa el asistente en este chat)"
                      className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-primary/40" />
                    <button disabled={sending || !reply.trim()} className={`${button} h-10 bg-[#6178ee] text-white hover:bg-[#6f8cff]`}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

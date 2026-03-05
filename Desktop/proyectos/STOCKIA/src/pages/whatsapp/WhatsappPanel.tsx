/**
 * WhatsApp Quick Chat Pro — 3-panel layout (desktop) / stepper (mobile).
 *
 * Panel A: ClientPicker (search, filters, customer list)
 * Panel B: Composer (templates, variable chips, editor, preview)
 * Panel C: QuickActions / History (tabs)
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { GlassPanel } from '@/components/ui/GlassCard'
import PageTitle from '@/components/PageTitle'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Customer } from '@/types/database'

// WhatsApp components
import ClientPicker from '@/components/whatsapp/ClientPicker'
import TemplateList from '@/components/whatsapp/TemplateList'
import Composer from '@/components/whatsapp/Composer'
import QuickActions from '@/components/whatsapp/QuickActions'
import History from '@/components/whatsapp/History'
import CatalogModal from '@/components/whatsapp/CatalogModal'

// WhatsApp lib
import {
  getTemplates,
  seedDefaultTemplates,
  getSettings,
  logMessage,
  updateLogStatus,
  getMessageLogs,
  getTodayMessageCount,
  openWhatsApp,
  buildWaLink,
  renderTemplate,
  normalizeArPhone,
  isValidArPhone,
} from '@/lib/whatsapp'
import type { WaTemplate, WaMessageLog, WaSettings, TemplateContext } from '@/lib/whatsapp'
import { createPublicLink, getPublicUrl } from '@/lib/publicLinks'

import {
  MessageCircle,
  ExternalLink,
  Smartphone,
  ArrowLeft,
  Zap,
  Clock,
  FileText,
  Phone,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────
   Recent IDs (localStorage)
───────────────────────────────────────────────────── */
const RECENT_KEY = 'stockia_wa_recent'
const MAX_RECENT = 15
function getRecentIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecentId(id: string) {
  const list = getRecentIds().filter((x) => x !== id)
  list.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

/* ─────────────────────────────────────────────────────
   Mobile steps
───────────────────────────────────────────────────── */
type MobileStep = 'client' | 'compose' | 'actions'

/* ─────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────── */
export default function WhatsappPanel() {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [settings, setSettings] = useState<WaSettings | null>(null)
  const [logs, setLogs] = useState<WaMessageLog[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Selection
  const [selected, setSelected] = useState<Customer | null>(null)
  const [manualPhone, setManualPhone] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null)
  const [message, setMessage] = useState('')

  // UI
  const [mobileStep, setMobileStep] = useState<MobileStep>('client')
  const [rightTab, setRightTab] = useState<'actions' | 'history'>('actions')
  const [composerTab, setComposerTab] = useState<'templates' | 'editor'>('templates')
  const [showCatalogModal, setShowCatalogModal] = useState(false)

  const businessName = business?.name || ''
  const recentIds = useMemo(() => getRecentIds(), [])

  // ── Load data ──────────────────────────────────────
  useEffect(() => {
    if (!profile?.business_id) return
    const bid = profile.business_id
    ;(async () => {
      // Seed defaults on first visit
      await seedDefaultTemplates(bid)

      const [custRes, tpls, sett, logData, count] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('business_id', bid)
          .order('name'),
        getTemplates(bid),
        getSettings(bid),
        getMessageLogs(bid),
        getTodayMessageCount(bid),
      ])

      setCustomers((custRes.data as Customer[]) || [])
      setTemplates(tpls)
      setSettings(sett)
      setLogs(logData)
      setTodayCount(count)
      setLoading(false)

      // Handle context from URL (?context=sale&contextId=xxx)
      const ctx = searchParams.get('context')
      const ctxId = searchParams.get('contextId')
      const custId = searchParams.get('customerId')
      if (custId && custRes.data) {
        const c = (custRes.data as Customer[]).find((x) => x.id === custId)
        if (c) selectCustomer(c, tpls)
      }
      if (ctx && tpls.length > 0) {
        const tplMap: Record<string, string> = {
          sale: 'Enviar ticket',
          invoice: 'Enviar factura',
          account: 'Recordatorio de pago',
        }
        const tpl = tpls.find((t) => t.name === tplMap[ctx])
        if (tpl) {
          setSelectedTemplate(tpl)
          setMessage(tpl.message)
          setComposerTab('editor')
        }
      }
    })()
  }, [profile?.business_id])

  // ── Build context for template rendering ───────────
  const templateContext = useMemo<TemplateContext>(() => {
    const ctx: TemplateContext = {
      business: { name: businessName },
    }
    if (selected) {
      ctx.customer = {
        name: selected.name,
        phone: selected.phone || undefined,
        balance: selected.balance,
      }
    }
    return ctx
  }, [selected, businessName])

  // ── Select customer ────────────────────────────────
  const selectCustomer = useCallback(
    (c: Customer, tpls?: WaTemplate[]) => {
      setSelected(c)
      setManualPhone('')
      // Load customer logs
      if (profile?.business_id) {
        getMessageLogs(profile.business_id, { customerId: c.id, limit: 20 }).then(setLogs)
      }
      // Auto-select first template if none
      const available = tpls || templates
      if (!selectedTemplate && available.length > 0) {
        setSelectedTemplate(available[0])
        setMessage(available[0].message)
      }
      if (isMobile) setMobileStep('compose')
    },
    [templates, selectedTemplate, profile?.business_id, isMobile]
  )

  // ── Select template ────────────────────────────────
  const selectTemplate = useCallback((t: WaTemplate) => {
    setSelectedTemplate(t)
    setMessage(t.message)
    setComposerTab('editor')
  }, [])

  // ── Manual phone ───────────────────────────────────
  const startManualPhone = useCallback(() => {
    setSelected(null)
    setManualPhone('')
    setMessage('')
    if (isMobile) setMobileStep('compose')
  }, [isMobile])

  // ── Send ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const phone = selected?.phone || manualPhone
    if (!phone) {
      toast.error('No hay teléfono para enviar')
      return
    }

    const normalised = normalizeArPhone(phone, settings?.default_country_code || '54')
    if (!isValidArPhone(normalised)) {
      toast.error(`Número inválido: ${normalised}. Verificá el teléfono.`)
      return
    }

    const rendered = renderTemplate(message, templateContext)
    const { success, url } = openWhatsApp(
      phone,
      rendered.result,
      settings?.send_mode || 'wa_me',
      settings?.default_country_code || '54'
    )

    if (!success) {
      toast.error('El navegador bloqueó la ventana. Permití los pop-ups e intentá de nuevo.')
      return
    }

    // Log
    if (profile?.business_id) {
      if (selected) pushRecentId(selected.id)
      await logMessage({
        businessId: profile.business_id,
        customerId: selected?.id,
        customerPhone: normalised,
        templateId: selectedTemplate?.id,
        contextType: 'manual',
        messageFinal: rendered.result,
        waUrl: url,
        status: 'opened',
      })
      setTodayCount((c) => c + 1)
      // Refresh logs
      const newLogs = await getMessageLogs(
        profile.business_id,
        selected ? { customerId: selected.id, limit: 20 } : undefined
      )
      setLogs(newLogs)
    }

    toast.success('WhatsApp abierto ✓')
  }, [selected, manualPhone, message, templateContext, settings, profile, selectedTemplate])

  // ── Copy ───────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const rendered = renderTemplate(message, templateContext)
    try {
      await navigator.clipboard.writeText(rendered.result)
      toast.success('Mensaje copiado')
      // Log copy
      if (profile?.business_id) {
        const phone = selected?.phone || manualPhone
        if (phone) {
          await logMessage({
            businessId: profile.business_id,
            customerId: selected?.id,
            customerPhone: normalizeArPhone(phone),
            messageFinal: rendered.result,
            waUrl: '',
            status: 'copied',
          })
        }
      }
    } catch {
      toast.error('No se pudo copiar')
    }
  }, [message, templateContext, selected, manualPhone, profile])

  // ── Copy wa.me link ────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    const phone = selected?.phone || manualPhone
    if (!phone) { toast.error('Sin teléfono'); return }
    const rendered = renderTemplate(message, templateContext)
    const url = buildWaLink(phone, rendered.result)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link wa.me copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }, [selected, manualPhone, message, templateContext])

  // ── Quick Actions handlers ─────────────────────────
  const handleQuickAction = useCallback(
    async (
      contextType: string,
      templateName: string,
      extraContext?: Partial<TemplateContext>
    ) => {
      if (!selected) { toast.error('Seleccioná un cliente'); return }
      const tpl = templates.find((t) => t.name === templateName)
      if (tpl) {
        setSelectedTemplate(tpl)
        setMessage(tpl.message)
      }
      setComposerTab('editor')
      if (isMobile) setMobileStep('compose')
    },
    [selected, templates, isMobile]
  )

  const handleSendTicket = useCallback(async () => {
    if (!selected || !profile?.business_id) return
    // Find last sale for this customer
    const { data: sale } = await supabase
      .from('sales')
      .select('id, total, created_at')
      .eq('business_id', profile.business_id)
      .eq('customer_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sale) { toast.error('No se encontraron ventas para este cliente'); return }

    // Create public link
    const link = await createPublicLink({
      businessId: profile.business_id,
      type: 'sale_ticket',
      refId: sale.id,
      expiresDays: 30,
    })

    const ticketUrl = link ? getPublicUrl(link.token) : '(link no disponible)'
    const tpl = templates.find((t) => t.name === 'Enviar ticket')
    if (tpl) {
      // Inject sale context into template
      let msg = tpl.message
        .replace('{{ticket.url}}', ticketUrl)
        .replace('{{sale.total}}', formatCurrency(sale.total))
        .replace('{{sale.date}}', new Date(sale.created_at).toLocaleDateString('es-AR'))
      setMessage(msg)
      setSelectedTemplate(tpl)
    }
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [selected, profile, templates, isMobile])

  const handleSendInvoice = useCallback(async () => {
    if (!selected || !profile?.business_id) return
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, punto_venta, cae, total, pdf_path')
      .eq('business_id', profile.business_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!inv) { toast.error('No se encontraron facturas'); return }

    const link = await createPublicLink({
      businessId: profile.business_id,
      type: 'invoice_pdf',
      refId: inv.id,
      expiresDays: 30,
    })

    const pdfUrl = link ? getPublicUrl(link.token) : '(link no disponible)'
    const invNumber = `${String(inv.punto_venta).padStart(4, '0')}-${String(inv.invoice_number).padStart(8, '0')}`
    const tpl = templates.find((t) => t.name === 'Enviar factura')
    if (tpl) {
      let msg = tpl.message
        .replace('{{invoice.number}}', invNumber)
        .replace('{{invoice.cae}}', inv.cae || '')
        .replace('{{invoice.pdf_url}}', pdfUrl)
        .replace('{{sale.total}}', formatCurrency(inv.total))
      setMessage(msg)
      setSelectedTemplate(tpl)
    }
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [selected, profile, templates, isMobile])

  const handlePaymentReminder = useCallback(() => {
    handleQuickAction('account', 'Recordatorio de pago')
  }, [handleQuickAction])

  const handleSendStatement = useCallback(async () => {
    if (!selected || !profile?.business_id) return
    const link = await createPublicLink({
      businessId: profile.business_id,
      type: 'account_statement',
      refId: selected.id,
      expiresDays: 30,
    })
    const url = link ? getPublicUrl(link.token) : '(link no disponible)'
    const tpl = templates.find((t) => t.name === 'Recordatorio de pago')
    if (tpl) {
      let msg = tpl.message.replace('{{statement.url}}', url)
      setMessage(msg)
      setSelectedTemplate(tpl)
    }
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [selected, profile, templates, isMobile])

  const handleSendDailySummary = useCallback(() => {
    handleQuickAction('summary', 'Consulta de stock')
  }, [handleQuickAction])

  const handleSendCatalog = useCallback(() => {
    setShowCatalogModal(true)
  }, [])

  const handleResendLast = useCallback(() => {
    if (logs.length === 0) { toast.error('Sin mensajes previos'); return }
    const last = logs[0]
    setMessage(last.message_final)
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [logs, isMobile])

  const handleResend = useCallback((log: WaMessageLog) => {
    setMessage(log.message_final)
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [isMobile])

  const handleMarkSent = useCallback(async (logId: string) => {
    await updateLogStatus(logId, 'sent')
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, status: 'sent' as const } : l)))
    toast.success('Marcado como enviado')
  }, [])

  // ── Catalog insert ─────────────────────────────────
  const handleCatalogInsert = useCallback((text: string) => {
    setMessage((prev) => (prev ? prev + '\n\n' + text : text))
    setComposerTab('editor')
    if (isMobile) setMobileStep('compose')
  }, [isMobile])

  // ── Attachment handlers for Composer ───────────────
  const handleAttachTicket = useCallback(() => { handleSendTicket() }, [handleSendTicket])
  const handleAttachInvoice = useCallback(() => { handleSendInvoice() }, [handleSendInvoice])
  const handleAttachStatement = useCallback(() => { handleSendStatement() }, [handleSendStatement])
  const handleAttachCatalog = useCallback(() => { setShowCatalogModal(true) }, [])

  // ── Render ─────────────────────────────────────────
  if (loading) return <LoadingSpinner />

  const hasPhone = !!(selected?.phone || manualPhone)
  const sendDisabled = !message.trim() || !hasPhone

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col overflow-hidden">
      <PageTitle
        title="WhatsApp"
        subtitle={`Enviá mensajes a tus clientes · ${todayCount} hoy`}
        actions={
          <div className="flex items-center gap-2">
            {todayCount > 0 && (
              <span className="text-[10px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-lg font-semibold">
                {todayCount} mensaje{todayCount !== 1 ? 's' : ''} hoy
              </span>
            )}
            <button
              onClick={() => window.open('https://web.whatsapp.com/', '_blank')}
              className="glass-btn inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Web</span>
            </button>
          </div>
        }
      />

      {/* Mobile tip */}
      {isMobile && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/50">
          <Smartphone className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
          Los mensajes se abrirán en la app de WhatsApp de tu celular.
        </div>
      )}

      {/* Mobile stepper nav */}
      {isMobile && (
        <div className="flex items-center gap-2 mb-3">
          {mobileStep !== 'client' && (
            <button
              onClick={() => setMobileStep(mobileStep === 'actions' ? 'compose' : 'client')}
              className="glass-btn p-2 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex gap-1 flex-1">
            {(['client', 'compose', 'actions'] as MobileStep[]).map((step) => (
              <button
                key={step}
                onClick={() => setMobileStep(step)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  mobileStep === step
                    ? 'bg-[#25D366]/20 text-[#25D366]'
                    : 'bg-white/5 text-white/30'
                }`}
              >
                {step === 'client' ? '1. Cliente' : step === 'compose' ? '2. Mensaje' : '3. Acciones'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ━━━━━ 3-Panel Layout ━━━━━ */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Panel A: Client Picker */}
        <GlassPanel
          className={`w-full lg:w-72 xl:w-80 shrink-0 overflow-hidden ${
            isMobile && mobileStep !== 'client' ? 'hidden' : ''
          }`}
        >
          <ClientPicker
            customers={customers}
            selected={selected}
            recentIds={recentIds}
            onSelect={(c) => selectCustomer(c)}
            onManualPhone={startManualPhone}
            onAddCustomer={async ({ name, phone }) => {
              if (!profile?.business_id) return
              const { data, error } = await supabase
                .from('customers')
                .insert({ business_id: profile.business_id, name, phone, balance: 0 })
                .select()
                .single()
              if (error) { toast.error('Error al crear cliente'); return }
              const newCust = data as Customer
              setCustomers((prev) => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)))
              selectCustomer(newCust)
              toast.success(`Cliente "${name}" creado`)
            }}
          />
        </GlassPanel>

        {/* Panel B: Composer */}
        <GlassPanel
          className={`flex-1 flex flex-col overflow-hidden ${
            isMobile && mobileStep !== 'compose' ? 'hidden' : ''
          }`}
        >
          {!selected && !manualPhone ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-[#25D366]/50" />
              </div>
              <h3 className="text-sm font-semibold text-white/60 mb-1">Seleccioná un cliente</h3>
              <p className="text-xs text-white/30 max-w-xs">
                Elegí un cliente o ingresá un número para componer tu mensaje con plantillas y variables.
              </p>
            </div>
          ) : (
            <>
              {/* Contact header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0">
                {selected ? (
                  <>
                    <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">
                      {selected.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
                      <p className="text-[11px] text-white/35">{selected.phone || 'Sin teléfono'}</p>
                    </div>
                    {selected.balance !== 0 && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        selected.balance < 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {formatCurrency(selected.balance)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-white/50" />
                    </div>
                    <div className="flex-1">
                      <input
                        type="tel"
                        placeholder="Ej: 11 2345-6789"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        autoFocus
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#25D366]/50"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Tabs: Templates | Editor */}
              <div className="flex border-b border-white/5 shrink-0">
                <button
                  onClick={() => setComposerTab('templates')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    composerTab === 'templates'
                      ? 'text-[#25D366] border-b-2 border-[#25D366]'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Plantillas
                </button>
                <button
                  onClick={() => setComposerTab('editor')}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    composerTab === 'editor'
                      ? 'text-[#25D366] border-b-2 border-[#25D366]'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5 inline mr-1" />
                  Compositor
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {composerTab === 'templates' ? (
                  <div className="h-full overflow-y-auto p-3">
                    <TemplateList
                      templates={templates}
                      selectedId={selectedTemplate?.id || null}
                      onSelect={selectTemplate}
                    />
                  </div>
                ) : (
                  <Composer
                    message={message}
                    onChange={setMessage}
                    context={templateContext}
                    signature={settings?.signature || ''}
                    greeting={settings?.default_greeting || 'Hola'}
                    onSend={handleSend}
                    onCopy={handleCopy}
                    onCopyLink={handleCopyLink}
                    sendDisabled={sendDisabled}
                    onAttachTicket={selected ? handleAttachTicket : undefined}
                    onAttachInvoice={selected ? handleAttachInvoice : undefined}
                    onAttachStatement={selected ? handleAttachStatement : undefined}
                    onAttachCatalog={handleAttachCatalog}
                  />
                )}
              </div>
            </>
          )}
        </GlassPanel>

        {/* Panel C: QuickActions / History */}
        <GlassPanel
          className={`w-full lg:w-72 xl:w-80 shrink-0 flex flex-col overflow-hidden ${
            isMobile && mobileStep !== 'actions' ? 'hidden' : ''
          }`}
        >
          {/* Tab selector */}
          <div className="flex border-b border-white/5 shrink-0">
            <button
              onClick={() => setRightTab('actions')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                rightTab === 'actions'
                  ? 'text-[#25D366] border-b-2 border-[#25D366]'
                  : 'text-white/35 hover:text-white/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Acciones
            </button>
            <button
              onClick={() => setRightTab('history')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                rightTab === 'history'
                  ? 'text-[#25D366] border-b-2 border-[#25D366]'
                  : 'text-white/35 hover:text-white/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Historial
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rightTab === 'actions' ? (
              <QuickActions
                hasCustomer={!!selected}
                onSendTicket={handleSendTicket}
                onSendInvoice={handleSendInvoice}
                onSendPaymentReminder={handlePaymentReminder}
                onSendDailySummary={handleSendDailySummary}
                onSendCatalog={handleSendCatalog}
                onSendStatement={handleSendStatement}
                onResendLast={handleResendLast}
              />
            ) : (
              <History
                logs={logs}
                onResend={handleResend}
                onMarkSent={handleMarkSent}
              />
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Catalog Modal */}
      <CatalogModal
        open={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onInsert={handleCatalogInsert}
      />
    </div>
  )
}

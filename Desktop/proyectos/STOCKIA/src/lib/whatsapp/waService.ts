/**
 * WhatsApp service — CRUD for templates, settings, message logs.
 * Also handles default template seeding.
 */

import { supabase } from '@/lib/supabase'
import { DEFAULT_TEMPLATES } from './defaultTemplates'

// ── Types ───────────────────────────────────────────────────

export interface WaTemplate {
  id: string
  business_id: string
  name: string
  category: string
  message: string
  is_active: boolean
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface WaMessageLog {
  id: string
  business_id: string
  customer_id: string | null
  customer_phone: string
  template_id: string | null
  context_type: string | null
  context_id: string | null
  message_final: string
  wa_url: string
  status: 'opened' | 'copied' | 'sent'
  tags: string[]
  created_at: string
}

export interface WaSettings {
  business_id: string
  default_country_code: string
  signature: string
  default_greeting: string
  send_mode: 'wa_me' | 'web'
  created_at: string
}

// ── Templates ───────────────────────────────────────────────

export async function getTemplates(businessId: string): Promise<WaTemplate[]> {
  const { data } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order')
  return (data as WaTemplate[]) || []
}

export async function seedDefaultTemplates(businessId: string): Promise<void> {
  // Check if already seeded
  const { count } = await supabase
    .from('whatsapp_templates')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)

  if ((count ?? 0) > 0) return

  const rows = DEFAULT_TEMPLATES.map((t) => ({
    business_id: businessId,
    name: t.name,
    category: t.category,
    message: t.message,
    is_default: true,
    sort_order: t.sort_order,
  }))

  await (supabase.from('whatsapp_templates') as any).insert(rows)
}

export async function createTemplate(
  businessId: string,
  data: { name: string; category: string; message: string }
): Promise<WaTemplate | null> {
  const { data: row } = await (supabase.from('whatsapp_templates') as any)
    .insert({ business_id: businessId, ...data })
    .select()
    .single()
  return row as WaTemplate | null
}

export async function updateTemplate(
  id: string,
  data: Partial<{ name: string; category: string; message: string; is_active: boolean; sort_order: number }>
): Promise<void> {
  await (supabase.from('whatsapp_templates') as any).update(data).eq('id', id)
}

export async function deleteTemplate(id: string): Promise<void> {
  await (supabase.from('whatsapp_templates') as any).update({ is_active: false }).eq('id', id)
}

// ── Settings ────────────────────────────────────────────────

export async function getSettings(businessId: string): Promise<WaSettings> {
  const { data } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  if (data) return data as WaSettings

  // Create default
  const defaults: Omit<WaSettings, 'created_at'> = {
    business_id: businessId,
    default_country_code: '54',
    signature: '— Enviado desde STOCKIA',
    default_greeting: 'Hola',
    send_mode: 'wa_me',
  }
  await (supabase.from('whatsapp_settings') as any).upsert(defaults)
  return { ...defaults, created_at: new Date().toISOString() }
}

export async function updateSettings(
  businessId: string,
  data: Partial<Omit<WaSettings, 'business_id' | 'created_at'>>
): Promise<void> {
  await (supabase.from('whatsapp_settings') as any).update(data).eq('business_id', businessId)
}

// ── Message Logs ────────────────────────────────────────────

export async function logMessage(params: {
  businessId: string
  customerId?: string | null
  customerPhone: string
  templateId?: string | null
  contextType?: string | null
  contextId?: string | null
  messageFinal: string
  waUrl: string
  status?: 'opened' | 'copied' | 'sent'
  tags?: string[]
}): Promise<string | null> {
  const { data } = await (supabase.from('whatsapp_message_logs') as any)
    .insert({
      business_id: params.businessId,
      customer_id: params.customerId ?? null,
      customer_phone: params.customerPhone,
      template_id: params.templateId ?? null,
      context_type: params.contextType ?? null,
      context_id: params.contextId ?? null,
      message_final: params.messageFinal,
      wa_url: params.waUrl,
      status: params.status ?? 'opened',
      tags: params.tags ?? [],
    })
    .select('id')
    .single()
  return (data as any)?.id ?? null
}

export async function updateLogStatus(logId: string, status: 'opened' | 'copied' | 'sent'): Promise<void> {
  await (supabase.from('whatsapp_message_logs') as any).update({ status }).eq('id', logId)
}

export async function getMessageLogs(
  businessId: string,
  options?: { customerId?: string; limit?: number }
): Promise<WaMessageLog[]> {
  let q = supabase
    .from('whatsapp_message_logs')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.customerId) q = q.eq('customer_id', options.customerId)

  const { data } = await q
  return (data as WaMessageLog[]) || []
}

export async function getTodayMessageCount(businessId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('whatsapp_message_logs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', today.toISOString())
  return count ?? 0
}

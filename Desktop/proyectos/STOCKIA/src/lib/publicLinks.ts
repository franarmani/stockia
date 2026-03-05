/**
 * Public Links — create & resolve shareable tokens for
 * tickets, invoices, account statements, and catalogs.
 */

import { supabase } from '@/lib/supabase'

// ── Types ───────────────────────────────────────────────────

export interface PublicLink {
  id: string
  business_id: string
  type: 'sale_ticket' | 'invoice_pdf' | 'account_statement' | 'catalog'
  ref_id: string
  token: string
  expires_at: string | null
  is_revoked: boolean
  created_at: string
}

// ── Token generation ────────────────────────────────────────

function generateToken(length = 48): string {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, length)
}

// ── Create ──────────────────────────────────────────────────

export async function createPublicLink(params: {
  businessId: string
  type: PublicLink['type']
  refId: string
  expiresDays?: number
}): Promise<PublicLink | null> {
  // Check if one already exists (non-revoked)
  const { data: existing } = await supabase
    .from('public_links')
    .select('*')
    .eq('business_id', params.businessId)
    .eq('type', params.type)
    .eq('ref_id', params.refId)
    .eq('is_revoked', false)
    .maybeSingle()

  if (existing) return existing as PublicLink

  const token = generateToken()
  const expiresAt = params.expiresDays
    ? new Date(Date.now() + params.expiresDays * 86400000).toISOString()
    : null

  const { data } = await (supabase.from('public_links') as any)
    .insert({
      business_id: params.businessId,
      type: params.type,
      ref_id: params.refId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single()

  return data as PublicLink | null
}

// ── Resolve (public — called from edge function or client) ──

export async function resolvePublicLink(token: string): Promise<{
  link: PublicLink
  valid: boolean
  reason?: string
} | null> {
  const { data } = await supabase
    .from('public_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!data) return null

  const link = data as PublicLink

  if (link.is_revoked) return { link, valid: false, reason: 'revoked' }
  if (link.expires_at && new Date(link.expires_at) < new Date())
    return { link, valid: false, reason: 'expired' }

  return { link, valid: true }
}

// ── Revoke ──────────────────────────────────────────────────

export async function revokePublicLink(linkId: string): Promise<void> {
  await (supabase.from('public_links') as any).update({ is_revoked: true }).eq('id', linkId)
}

// ── Get public URL ──────────────────────────────────────────

export function getPublicUrl(token: string): string {
  return `${window.location.origin}/p/${token}`
}

// ── List links for a business ───────────────────────────────

export async function getPublicLinks(
  businessId: string,
  type?: PublicLink['type']
): Promise<PublicLink[]> {
  let q = supabase
    .from('public_links')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (type) q = q.eq('type', type)

  const { data } = await q
  return (data as PublicLink[]) || []
}

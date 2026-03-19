// supabase/functions/afip-authorize-invoice/index.ts
// Edge Function: Authorize invoice via billing-service → AFIP WSAA/WSFEv1
// POST /afip/authorize-invoice  { invoice_id }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabase.from('users').select('business_id').eq('id', user.id).single()
    if (!profile) throw new Error('No profile found')

    const { invoice_id } = await req.json()
    if (!invoice_id) throw new Error('invoice_id is required')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Get invoice
    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('business_id', profile.business_id)
      .single()

    if (invError || !invoice) throw new Error('Invoice not found')
    if (invoice.status !== 'draft') throw new Error('Invoice already processed')

    // Get fiscal_settings
    const invoiceEnv = invoice.env || 'homo'
    const { data: fiscal } = await supabaseAdmin
      .from('fiscal_settings')
      .select('*')
      .eq('business_id', profile.business_id)
      .eq('env', invoiceEnv)
      .single()

    if (!fiscal) throw new Error('Fiscal settings not configured')
    if (fiscal.cert_status !== 'connected') throw new Error('AFIP not connected. Complete wizard first.')

    // Get invoice items
    const { data: items } = await supabaseAdmin
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)

    // Call billing service
    const BILLING_SERVICE_URL = Deno.env.get('BILLING_SERVICE_URL') || 'http://localhost:3001'
    const BILLING_SERVICE_KEY = Deno.env.get('BILLING_SERVICE_KEY') || ''

    const authorizeRes = await fetch(`${BILLING_SERVICE_URL}/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': BILLING_SERVICE_KEY,
      },
      body: JSON.stringify({
        business_id: profile.business_id,
        env: invoiceEnv,
        supabase_url: Deno.env.get('SUPABASE_URL'),
        supabase_service_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        enc_key: Deno.env.get('FISCAL_ENC_KEY'),
        invoice: {
          ...invoice,
          items: items || [],
        },
        fiscal_settings: fiscal,
      }),
    })

    const result = await authorizeRes.json()

    if (!authorizeRes.ok || !result.cae) {
      // Update invoice as rejected
      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'rejected',
          afip_response: JSON.stringify(result),
        })
        .eq('id', invoice_id)

      throw new Error(result.error || 'AFIP rejected the invoice')
    }

    // Upload PDF to Supabase Storage if provided
    let pdfPath: string | null = null
    if (result.pdf_base64) {
      const pdfBuffer = Uint8Array.from(atob(result.pdf_base64), c => c.charCodeAt(0))
      pdfPath = `invoices/${profile.business_id}/${invoice_id}.pdf`
      
      await supabaseAdmin.storage
        .from('afip-certs')  // reuse bucket or create 'invoices' bucket
        .upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })
    }

    // Update invoice as authorized
    await supabaseAdmin
      .from('invoices')
      .update({
        status: 'authorized',
        cae: result.cae,
        cae_expiry: result.cae_vto,
        invoice_number: result.cbte_nro,
        afip_request: JSON.stringify(result.afip_request || {}),
        afip_response: JSON.stringify(result.afip_response || {}),
        pdf_path: pdfPath,
      })
      .eq('id', invoice_id)

    // Build PDF URL
    let pdf_url = null
    if (pdfPath) {
      const { data: urlData } = supabaseAdmin.storage
        .from('afip-certs')
        .getPublicUrl(pdfPath)
      pdf_url = urlData?.publicUrl
    }

    return new Response(
      JSON.stringify({
        cae: result.cae,
        cae_vto: result.cae_vto,
        cbte_nro: result.cbte_nro,
        pdf_url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

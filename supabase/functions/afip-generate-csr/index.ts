// supabase/functions/afip-generate-csr/index.ts
// Edge Function: Generate RSA 2048 key pair + CSR, store encrypted private key
// POST /afip/generate-csr  { env: 'homo' | 'prod' }

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

    // Get user's business_id
    const { data: profile } = await supabase.from('users').select('business_id, role').eq('id', user.id).single()
    if (!profile) throw new Error('No profile found')
    if (profile.role !== 'admin') throw new Error('Only admins can generate CSR')

    const { env = 'homo' } = await req.json()
    if (!['homo', 'prod'].includes(env)) throw new Error('Invalid env')

    // Get fiscal_settings
    const { data: fiscal } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('business_id', profile.business_id)
      .eq('env', env)
      .single()

    if (!fiscal) throw new Error('Fiscal settings not found. Complete step 1 first.')

    // ============================================================
    // Generate RSA 2048 key pair + CSR
    // In Deno, we use the Web Crypto API for key generation
    // and call the billing-service for CSR creation.
    //
    // For now: call the billing-service /generate-csr endpoint
    // which handles OpenSSL operations natively in Node.
    // ============================================================
    const BILLING_SERVICE_URL = Deno.env.get('BILLING_SERVICE_URL') || 'http://localhost:3001'
    const BILLING_SERVICE_KEY = Deno.env.get('BILLING_SERVICE_KEY') || ''
    const ENC_KEY = Deno.env.get('FISCAL_ENC_KEY') || ''

    // Diagnostico util: sin esto, cualquier problema del servicio aparecia
    // como un generico "non-2xx status code" imposible de rastrear.
    if (!BILLING_SERVICE_URL || BILLING_SERVICE_URL.includes('localhost')) {
      throw new Error('El servicio de facturación no está configurado (BILLING_SERVICE_URL apunta a localhost).')
    }

    let csrRes: Response
    try {
      csrRes = await fetch(`${BILLING_SERVICE_URL}/generate-csr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': BILLING_SERVICE_KEY,
      },
      body: JSON.stringify({
        cuit: fiscal.cuit,
        razon_social: fiscal.razon_social,
        enc_key: ENC_KEY,
      }),
      })
    } catch (netErr) {
      throw new Error(`No se pudo contactar al servicio de facturación en ${BILLING_SERVICE_URL}: ${(netErr as Error).message}`)
    }

    if (!csrRes.ok) {
      const errBody = await csrRes.text()
      throw new Error(`El servicio de facturación respondió ${csrRes.status}: ${errBody.slice(0, 300)}`)
    }

    const { csr_pem, private_key_enc } = await csrRes.json()

    // Use service role client for writing fiscal_keys
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Upsert fiscal_keys
    const { error: keyError } = await supabaseAdmin
      .from('fiscal_keys')
      .upsert({
        business_id: profile.business_id,
        env,
        private_key_enc,
        csr_pem,
        crt_pem: null,
      }, { onConflict: 'business_id,env' })

    if (keyError) throw new Error(`Failed to store keys: ${keyError.message}`)

    // Update cert_status
    await supabaseAdmin
      .from('fiscal_settings')
      .update({ cert_status: 'csr_generated' })
      .eq('business_id', profile.business_id)
      .eq('env', env)

    const cuit = fiscal.cuit.replace(/[-\s]/g, '')
    return new Response(
      JSON.stringify({
        csr_pem,
        csr_download_name: `stockia-${cuit}.csr`,
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

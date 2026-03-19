// supabase/functions/afip-test/index.ts
// Edge Function: Test AFIP connection via billing-service
// POST /afip/test  { env }

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

    const { env = 'homo' } = await req.json()

    const BILLING_SERVICE_URL = Deno.env.get('BILLING_SERVICE_URL') || 'http://localhost:3001'
    const BILLING_SERVICE_KEY = Deno.env.get('BILLING_SERVICE_KEY') || ''

    // 1) Health check
    const healthRes = await fetch(`${BILLING_SERVICE_URL}/health`)
    if (!healthRes.ok) throw new Error('Billing service not available')

    // 2) Test AFIP connection
    const testRes = await fetch(`${BILLING_SERVICE_URL}/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': BILLING_SERVICE_KEY,
      },
      body: JSON.stringify({
        business_id: profile.business_id,
        env,
        supabase_url: Deno.env.get('SUPABASE_URL'),
        supabase_service_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        enc_key: Deno.env.get('FISCAL_ENC_KEY'),
      }),
    })

    const testData = await testRes.json()

    if (!testRes.ok || !testData.ok) {
      throw new Error(testData.error || 'AFIP connection test failed')
    }

    // Update cert_status to connected
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabaseAdmin
      .from('fiscal_settings')
      .update({ cert_status: 'connected' })
      .eq('business_id', profile.business_id)
      .eq('env', env)

    return new Response(
      JSON.stringify({ ok: true, message: testData.message || 'Conexión exitosa con AFIP' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

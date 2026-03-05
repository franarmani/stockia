// supabase/functions/afip-upload-crt/index.ts
// Edge Function: Receive CRT from client, store in fiscal_keys
// POST /afip/upload-crt  { env, crt_pem }

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

    const { data: profile } = await supabase.from('users').select('business_id, role').eq('id', user.id).single()
    if (!profile) throw new Error('No profile found')
    if (profile.role !== 'admin') throw new Error('Only admins can upload certificates')

    const { env = 'homo', crt_pem } = await req.json()
    if (!crt_pem) throw new Error('crt_pem is required')
    if (!['homo', 'prod'].includes(env)) throw new Error('Invalid env')

    // Validate it looks like a PEM certificate
    if (!crt_pem.includes('BEGIN CERTIFICATE')) {
      throw new Error('El archivo no parece ser un certificado válido (.crt / .pem)')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Check that fiscal_keys exists (CSR must have been generated first)
    const { data: keys } = await supabaseAdmin
      .from('fiscal_keys')
      .select('id')
      .eq('business_id', profile.business_id)
      .eq('env', env)
      .single()

    if (!keys) throw new Error('Primero generá el CSR (paso 2)')

    // Update CRT
    const { error: updateError } = await supabaseAdmin
      .from('fiscal_keys')
      .update({ crt_pem })
      .eq('business_id', profile.business_id)
      .eq('env', env)

    if (updateError) throw new Error(`Failed to store CRT: ${updateError.message}`)

    // Update cert_status
    await supabaseAdmin
      .from('fiscal_settings')
      .update({ cert_status: 'crt_uploaded' })
      .eq('business_id', profile.business_id)
      .eq('env', env)

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

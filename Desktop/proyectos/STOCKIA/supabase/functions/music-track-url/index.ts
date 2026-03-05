// supabase/functions/music-track-url/index.ts
// POST /music-track-url { track_id } — validates premium access, returns signed audio URL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIGNED_URL_EXPIRES = 300 // 5 minutes

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

    const { data: profile } = await supabase
      .from('users')
      .select('business_id')
      .eq('id', user.id)
      .single()
    if (!profile) throw new Error('No profile found')

    // Verify music access
    const { data: access } = await supabase
      .from('business_music_access')
      .select('enabled')
      .eq('business_id', profile.business_id)
      .maybeSingle()

    if (!access?.enabled) throw new Error('Music access not enabled for this account')

    const { track_id } = await req.json()
    if (!track_id) throw new Error('track_id is required')

    // Get track info
    const { data: track, error: trackErr } = await supabase
      .from('music_tracks')
      .select('id, audio_path, mime, is_active')
      .eq('id', track_id)
      .single()

    if (trackErr || !track) throw new Error('Track not found')
    if (!track.is_active) throw new Error('Track is not available')

    // Generate signed URL using service role for private bucket
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: signed, error: signErr } = await serviceSupabase
      .storage
      .from('music-audio')
      .createSignedUrl(track.audio_path, SIGNED_URL_EXPIRES)

    if (signErr || !signed) throw new Error('Failed to generate signed URL')

    return new Response(
      JSON.stringify({
        track_id,
        url: signed.signedUrl,
        expires_in: SIGNED_URL_EXPIRES,
        mime: track.mime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

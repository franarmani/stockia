// supabase/functions/music-save-state/index.ts
// POST /music-save-state — persists playback state for a business

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

    const { data: profile } = await supabase
      .from('users')
      .select('business_id')
      .eq('id', user.id)
      .single()
    if (!profile) throw new Error('No profile found')

    const body = await req.json()

    const { error: upsertErr } = await supabase
      .from('music_playback_state')
      .upsert({
        business_id: profile.business_id,
        active_playlist_id: body.active_playlist_id ?? null,
        current_track_id: body.current_track_id ?? null,
        current_time_sec: body.current_time_sec ?? 0,
        volume: body.volume ?? 0.8,
        is_muted: body.is_muted ?? false,
        is_playing: false, // always save as stopped (don't resume auto-play)
        shuffle: body.shuffle ?? true,
        repeat_mode: body.repeat_mode ?? 'all',
        updated_at: new Date().toISOString(),
      })

    if (upsertErr) throw upsertErr

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

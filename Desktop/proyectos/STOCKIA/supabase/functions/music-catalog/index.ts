// supabase/functions/music-catalog/index.ts
// GET /music-catalog — returns playlists with their tracks metadata (no audio URLs)

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

    // Verify music access
    const { data: access } = await supabase
      .from('business_music_access')
      .select('enabled, plan_tier')
      .eq('business_id', profile.business_id)
      .maybeSingle()

    // Playlists: global (business_id null) + business-specific
    const { data: playlists, error: plErr } = await supabase
      .from('music_playlists')
      .select(`
        id, name, description, cover_path, business_id, is_active,
        music_playlist_items (
          id, position,
          music_tracks (
            id, title, artist, genre, mood, duration_seconds, cover_path, mime, is_active
          )
        )
      `)
      .eq('is_active', true)
      .or(`business_id.is.null,business_id.eq.${profile.business_id}`)
      .order('name')

    if (plErr) throw plErr

    // Current playback state
    const { data: state } = await supabase
      .from('music_playback_state')
      .select('*')
      .eq('business_id', profile.business_id)
      .maybeSingle()

    return new Response(
      JSON.stringify({
        access: access ?? { enabled: false, plan_tier: 'free' },
        playlists: playlists ?? [],
        playbackState: state ?? null,
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

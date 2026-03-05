// supabase/functions/music-admin-upload/index.ts
// Handles two actions for superadmins:
//   action:"initiate" → creates DB row + returns signed upload URL
//   action:"confirm"  → activates track + adds to business playlist

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
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

    // Only superadmins
    const { data: profile } = await supabase
      .from('users')
      .select('is_superadmin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_superadmin) throw new Error('Superadmin required')

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const action: string = body.action ?? 'initiate'

    // ─── CONFIRM: activate track + add to playlist ───────────────────────────
    if (action === 'confirm') {
      const { track_id, business_id } = body
      if (!track_id || !business_id) throw new Error('track_id and business_id are required')

      // 1. Activate track
      const { error: activateErr } = await serviceSupabase
        .from('music_tracks')
        .update({ is_active: true })
        .eq('id', track_id)
      if (activateErr) throw activateErr

      // 2. Get or create "Canciones Subidas" playlist for this business
      let { data: playlist } = await serviceSupabase
        .from('music_playlists')
        .select('id')
        .eq('business_id', business_id)
        .eq('name', 'Canciones Subidas')
        .eq('is_active', true)
        .maybeSingle()

      if (!playlist) {
        const { data: newPl, error: plErr } = await serviceSupabase
          .from('music_playlists')
          .insert({
            name: 'Canciones Subidas',
            description: 'Canciones subidas por el negocio',
            cover_path: null,
            business_id,
            is_active: true,
          })
          .select('id')
          .single()
        if (plErr) throw plErr
        playlist = newPl
      }

      // 3. Get current max position
      const { data: items } = await serviceSupabase
        .from('music_playlist_items')
        .select('position')
        .eq('playlist_id', playlist!.id)
        .order('position', { ascending: false })
        .limit(1)
      const maxPos = (items?.[0]?.position ?? 0) as number

      // 4. Add track to playlist
      const { error: itemErr } = await serviceSupabase
        .from('music_playlist_items')
        .insert({ playlist_id: playlist!.id, track_id, position: maxPos + 1 })
      if (itemErr) throw itemErr

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── INITIATE: create DB row + signed upload URL ─────────────────────────
    const { title, artist, genre, mood, duration_seconds, mime, size_bytes, filename } = body

    if (!title || !filename || !mime || !size_bytes) {
      throw new Error('title, filename, mime, size_bytes son requeridos')
    }

    const audio_path = `tracks/${crypto.randomUUID()}/${filename}`

    // Signed upload URL for audio (valid 15 minutes)
    const { data: audioUpload, error: audioErr } = await serviceSupabase
      .storage
      .from('music-audio')
      .createSignedUploadUrl(audio_path)
    if (audioErr) throw audioErr

    // Insert track metadata (inactive until confirmed)
    const { data: track, error: trackErr } = await serviceSupabase
      .from('music_tracks')
      .insert({
        title,
        artist: artist ?? null,
        genre: genre ?? null,
        mood: mood ?? null,
        duration_seconds: duration_seconds ?? null,
        cover_path: null,
        audio_path,
        mime,
        size_bytes,
        is_active: false,
      })
      .select('id')
      .single()

    if (trackErr) throw trackErr

    return new Response(
      JSON.stringify({
        track_id: track.id,
        audio_upload_url: audioUpload.signedUrl,
        audio_path,
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

    // Only superadmins
    const { data: profile } = await supabase
      .from('users')
      .select('is_superadmin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_superadmin) throw new Error('Superadmin required')

    const body = await req.json()
    const { title, artist, genre, mood, duration_seconds, mime, size_bytes, filename, cover_filename } = body

    if (!title || !filename || !mime || !size_bytes) {
      throw new Error('title, filename, mime, size_bytes are required')
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const audio_path = `tracks/${crypto.randomUUID()}/${filename}`
    const cover_path = cover_filename
      ? `covers/${crypto.randomUUID()}/${cover_filename}`
      : null

    // Signed upload URL for audio (valid 15 minutes)
    const { data: audioUpload, error: audioErr } = await serviceSupabase
      .storage
      .from('music-audio')
      .createSignedUploadUrl(audio_path)
    if (audioErr) throw audioErr

    // Signed upload URL for cover (optional)
    let coverUpload = null
    if (cover_path) {
      const { data: cv, error: cvErr } = await serviceSupabase
        .storage
        .from('music-covers')
        .createSignedUploadUrl(cover_path)
      if (!cvErr) coverUpload = cv
    }

    // Insert track metadata
    const { data: track, error: trackErr } = await serviceSupabase
      .from('music_tracks')
      .insert({
        title,
        artist: artist ?? null,
        genre: genre ?? null,
        mood: mood ?? null,
        duration_seconds: duration_seconds ?? null,
        cover_path,
        audio_path,
        mime,
        size_bytes,
        is_active: false, // activate after upload confirmed
      })
      .select('id')
      .single()

    if (trackErr) throw trackErr

    return new Response(
      JSON.stringify({
        track_id: track.id,
        audio_upload_url: audioUpload.signedUrl,
        audio_upload_token: audioUpload.token,
        cover_upload_url: coverUpload?.signedUrl ?? null,
        audio_path,
        cover_path,
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

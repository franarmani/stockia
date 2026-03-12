// src/lib/music/api.ts
// Music API: direct Supabase queries (no Edge Function required for catalog/state).
// Edge Function is used ONLY for signed audio URLs (needs service-role on private bucket).

import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MusicTrackMeta {
  id: string
  title: string
  artist: string | null
  genre: string | null
  mood: string | null
  duration_seconds: number | null
  cover_path: string | null
  audio_path: string   // storage path — needed for client-side signed URL
  mime: string
  is_active: boolean
}

export interface PlaylistItem {
  id: string
  position: number
  music_tracks: MusicTrackMeta
}

export interface MusicPlaylist {
  id: string
  name: string
  description: string | null
  cover_path: string | null
  business_id: string | null
  music_playlist_items: PlaylistItem[]
}

export interface MusicAccess {
  enabled: boolean
  plan_tier: 'free' | 'pro' | 'premium'
}

export interface PlaybackState {
  business_id: string
  active_playlist_id: string | null
  current_track_id: string | null
  current_time_sec: number
  volume: number
  is_muted: boolean
  is_playing: boolean
  shuffle: boolean
  repeat_mode: 'off' | 'one' | 'all'
  updated_at: string
}

export interface MusicCatalog {
  access: MusicAccess
  playlists: MusicPlaylist[]
  playbackState: PlaybackState | null
}

export interface TrackUrlResponse {
  track_id: string
  url: string
  expires_in: number
  mime: string
}

const SIGNED_URL_EXPIRES = 300 // 5 minutes

// ─── Local static tracks — read from /music-catalog.json ─────────────────

interface LocalTrackEntry {
  id: string
  title: string
  artist: string | null
  genre: string | null
  audio_path: string
  mime?: string
}

interface LocalCategory {
  id: string
  name: string
  folder: string | null
  tracks: LocalTrackEntry[]
}

function makePlaylistFromTracks(id: string, name: string, tracks: LocalTrackEntry[]): MusicPlaylist {
  return {
    id,
    name,
    description: null,
    cover_path: null,
    business_id: null,
    music_playlist_items: tracks.map((t, i) => ({
      id: `${id}-item-${t.id}`,
      position: i + 1,
      music_tracks: {
        id: t.id,
        title: t.title,
        artist: t.artist ?? null,
        genre: t.genre ?? null,
        mood: null,
        duration_seconds: null,
        cover_path: null,
        audio_path: t.audio_path,
        mime: t.mime ?? 'audio/mpeg',
        is_active: true,
      },
    })),
  }
}

async function fetchLocalCatalog(): Promise<MusicPlaylist[]> {
  try {
    const res = await fetch('/music-catalog.json')
    if (!res.ok) return []
    const raw = await res.json()

    // New format: array of categories [{id, name, folder, tracks:[]}]
    if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]?.tracks)) {
      const categories: LocalCategory[] = raw
      return categories
        .filter(c => c.tracks.length > 0)
        .map(c => makePlaylistFromTracks(c.id, c.name, c.tracks))
    }

    // Legacy format: flat array of tracks
    if (Array.isArray(raw) && raw.length > 0) {
      const tracks: LocalTrackEntry[] = raw
      return [makePlaylistFromTracks('local-static', 'Mis Canciones', tracks)]
    }

    return []
  } catch {
    return []
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns a public cover URL from the music-covers bucket. */
export function getCoverUrl(cover_path: string | null | undefined): string | null {
  if (!cover_path) return null
  const { data } = supabase.storage.from('music-covers').getPublicUrl(cover_path)
  return data.publicUrl
}

// ─── API calls — direct Supabase queries ───────────────────────────────────

/**
 * Fetch full catalog using direct Supabase queries.
 * businessId is the current user's business_id (from authStore).
 */
export async function fetchMusicCatalog(businessId: string): Promise<MusicCatalog> {
  // 1) Check feature access
  const { data: accessRow } = await supabase
    .from('business_music_access')
    .select('enabled, plan_tier')
    .eq('business_id', businessId)
    .maybeSingle()

  let access: MusicAccess = accessRow
    ? { enabled: accessRow.enabled, plan_tier: (accessRow.plan_tier ?? 'free') as MusicAccess['plan_tier'] }
    : { enabled: false, plan_tier: 'free' }

  // 2) Playlists (global + business-specific) — only if enabled
  let playlists: MusicPlaylist[] = []
  if (access.enabled) {
    const { data: plData, error: plErr } = await supabase
      .from('music_playlists')
      .select(`
        id, name, description, cover_path, business_id,
        music_playlist_items (
          id, position,
          music_tracks (
            id, title, artist, genre, mood, duration_seconds, cover_path, audio_path, mime, is_active
          )
        )
      `)
      .eq('is_active', true)
      .or(`business_id.is.null,business_id.eq.${businessId}`)
      .order('name')

    if (plErr) console.warn('[Music] playlists query failed:', plErr.message)
    else playlists = (plData ?? []) as unknown as MusicPlaylist[]
  }

  // 3) Persisted playback state
  const { data: stateRow } = await supabase
    .from('music_playback_state')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  // Always include local static tracks from /music-catalog.json
  const localPlaylists = await fetchLocalCatalog()
  if (localPlaylists.length > 0) {
    playlists.push(...localPlaylists)
  }
  // If Supabase has music disabled, still allow playback of local tracks
  if (!access.enabled && localPlaylists.length > 0) {
    access = { enabled: true, plan_tier: 'free' }
  }

  return {
    access,
    playlists,
    playbackState: stateRow as PlaybackState | null,
  }
}

/**
 * Get a signed playback URL for a track.
 * Tries client-side Storage first (works when storage RLS allows it),
 * then falls back to the Edge Function (requires it to be deployed).
 */
export async function getTrackSignedUrl(
  track_id: string,
  audio_path: string,
): Promise<TrackUrlResponse> {
  // Try client-side signed URL (needs storage SELECT policy on music-audio bucket)
  const { data: signed, error: signErr } = await supabase
    .storage
    .from('music-audio')
    .createSignedUrl(audio_path, SIGNED_URL_EXPIRES)

  if (!signErr && signed?.signedUrl) {
    return {
      track_id,
      url: signed.signedUrl,
      expires_in: SIGNED_URL_EXPIRES,
      mime: 'audio/mpeg',
    }
  }

  // Fallback: Edge Function (deployed separately)
  const { data, error } = await supabase.functions.invoke('music-track-url', {
    body: { track_id },
  })
  if (error) throw new Error(`Signed URL failed: ${error.message}`)
  if (data?.error) throw new Error(data.error)
  return data as TrackUrlResponse
}

// ─── Upload API ────────────────────────────────────────────────────────────

/**
 * Step 1: call edge function to get a signed upload URL + create DB row.
 */
export async function initiateTrackUpload(metadata: {
  title: string
  artist?: string | null
  genre?: string | null
  filename: string
  mime: string
  size_bytes: number
}): Promise<{ track_id: string; audio_upload_url: string }> {
  const { data, error } = await supabase.functions.invoke('music-admin-upload', {
    body: { action: 'initiate', ...metadata },
  })
  if (error) throw new Error(`Error al iniciar subida: ${error.message}`)
  if (data?.error) throw new Error(data.error)
  return data as { track_id: string; audio_upload_url: string }
}

/**
 * Step 2: upload the file bytes directly to the signed URL.
 */
export async function uploadFileToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload HTTP ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'))
    xhr.send(file)
  })
}

/**
 * Step 3: activate the track and add it to the business playlist.
 */
export async function confirmTrackUpload(trackId: string, businessId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('music-admin-upload', {
    body: { action: 'confirm', track_id: trackId, business_id: businessId },
  })
  if (error) throw new Error(`Error al confirmar subida: ${error.message}`)
  if (data?.error) throw new Error(data.error)
}

/**
 * Persist playback state — direct upsert, no Edge Function needed.
 */
export async function savePlaybackState(
  businessId: string,
  state: {
    active_playlist_id: string | null
    current_track_id: string | null
    current_time_sec: number
    volume: number
    is_muted: boolean
    shuffle: boolean
    repeat_mode: string
  }
): Promise<void> {
  // Local playlists/tracks have non-UUID IDs — skip persisting to Supabase
  const isLocal = (id: string | null) => !!id && id.startsWith('local-')
  if (isLocal(state.active_playlist_id) || isLocal(state.current_track_id)) return

  const { error } = await supabase
    .from('music_playback_state')
    .upsert({
      business_id: businessId,
      active_playlist_id: state.active_playlist_id,
      current_track_id: state.current_track_id,
      current_time_sec: state.current_time_sec,
      volume: state.volume,
      is_muted: state.is_muted,
      is_playing: false,
      shuffle: state.shuffle,
      repeat_mode: state.repeat_mode,
      updated_at: new Date().toISOString(),
    })
  if (error) console.warn('[Music] save state failed:', error.message)
}

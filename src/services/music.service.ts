import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { MusicPlaylist, MusicTrack } from '@/types/music'

type MusicPlaylistRow = Database['public']['Tables']['music_playlists']['Row']
type MusicPlaylistInsert = Database['public']['Tables']['music_playlists']['Insert']
type MusicPlaylistUpdate = Database['public']['Tables']['music_playlists']['Update']
type MusicTrackRow = Database['public']['Tables']['music_tracks']['Row']

function mapPlaylist(row: MusicPlaylistRow, fallbackBusinessId = ''): MusicPlaylist {
  return {
    id: row.id,
    business_id: row.business_id ?? fallbackBusinessId,
    name: row.name,
    description: row.description,
    mood: null,
    category: null,
    cover_url: row.cover_path,
    is_active: row.is_active,
    is_public: row.business_id === null,
    created_at: row.created_at,
  }
}

async function resolveTrackUrl(row: MusicTrackRow): Promise<string> {
  if (/^https?:\/\//i.test(row.audio_path)) return row.audio_path

  const { data, error } = await supabase.storage
    .from('music-audio')
    .createSignedUrl(row.audio_path, 60 * 60)

  if (error) throw error
  return data.signedUrl
}

async function mapTrack(row: MusicTrackRow, playlistId: string, position: number): Promise<MusicTrack> {
  const youtubeMatch = row.mime === 'video/youtube'
    ? row.audio_path.match(/[?&]v=([^&]+)/)
    : null

  return {
    id: row.id,
    playlist_id: playlistId,
    business_id: '',
    title: row.title,
    artist: row.artist,
    file_url: await resolveTrackUrl(row),
    file_path: /^https?:\/\//i.test(row.audio_path) ? null : row.audio_path,
    youtube_id: youtubeMatch?.[1] ?? null,
    duration: row.duration_seconds,
    order_index: position,
    created_at: row.created_at,
  }
}

async function nextPlaylistPosition(playlistId: string): Promise<number> {
  const { data, error } = await supabase
    .from('music_playlist_items')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data?.position ?? -1) + 1
}

export const musicService = {
  async getPlaylists(businessId: string): Promise<MusicPlaylist[]> {
    const { data, error } = await supabase
      .from('music_playlists')
      .select('*')
      .or(`business_id.is.null,business_id.eq.${businessId}`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(row => mapPlaylist(row, businessId))
  },

  async createPlaylist(playlist: Partial<MusicPlaylist>): Promise<MusicPlaylist> {
    if (!playlist.name?.trim()) throw new Error('La playlist necesita un nombre')

    const payload: MusicPlaylistInsert = {
      business_id: playlist.business_id || null,
      name: playlist.name.trim(),
      description: playlist.description ?? null,
      cover_path: playlist.cover_url ?? null,
      is_active: playlist.is_active ?? true,
    }

    const { data, error } = await supabase
      .from('music_playlists')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return mapPlaylist(data, playlist.business_id)
  },

  async updatePlaylist(id: string, updates: Partial<MusicPlaylist>): Promise<MusicPlaylist> {
    const payload: MusicPlaylistUpdate = {}
    if (updates.business_id !== undefined) payload.business_id = updates.business_id || null
    if (updates.name !== undefined) payload.name = updates.name.trim()
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.cover_url !== undefined) payload.cover_path = updates.cover_url
    if (updates.is_active !== undefined) payload.is_active = updates.is_active

    const { data, error } = await supabase
      .from('music_playlists')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return mapPlaylist(data, updates.business_id)
  },

  async deletePlaylist(id: string): Promise<void> {
    const { error } = await supabase.from('music_playlists').delete().eq('id', id)
    if (error) throw error
  },

  async getTracksByPlaylist(playlistId: string): Promise<MusicTrack[]> {
    const { data, error } = await supabase
      .from('music_playlist_items')
      .select('position, music_tracks(*)')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true })

    if (error) throw error

    return Promise.all((data ?? []).flatMap(item => {
      const track = item.music_tracks
      return track ? [mapTrack(track, playlistId, item.position)] : []
    }))
  },

  async uploadTrack(
    businessId: string,
    playlistId: string,
    file: File,
    metadata: { title: string; artist?: string; duration?: number },
  ): Promise<MusicTrack> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filePath = `${businessId}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('music-audio')
      .upload(filePath, file, { contentType: file.type || 'audio/mpeg' })

    if (uploadError) throw uploadError

    const { data: track, error: trackError } = await supabase
      .from('music_tracks')
      .insert({
        title: metadata.title,
        artist: metadata.artist ?? null,
        duration_seconds: metadata.duration ?? null,
        audio_path: filePath,
        mime: file.type || 'audio/mpeg',
        size_bytes: file.size,
      })
      .select()
      .single()

    if (trackError) {
      await supabase.storage.from('music-audio').remove([filePath])
      throw trackError
    }

    const position = await nextPlaylistPosition(playlistId)
    const { error: itemError } = await supabase
      .from('music_playlist_items')
      .insert({ playlist_id: playlistId, track_id: track.id, position })

    if (itemError) throw itemError
    return mapTrack(track, playlistId, position)
  },

  async createYouTubeTrack(
    _businessId: string,
    playlistId: string,
    youtubeId: string,
    metadata: { title: string; artist?: string },
  ): Promise<MusicTrack> {
    const { data: track, error: trackError } = await supabase
      .from('music_tracks')
      .insert({
        title: metadata.title,
        artist: metadata.artist ?? null,
        audio_path: `https://www.youtube.com/watch?v=${youtubeId}`,
        mime: 'video/youtube',
      })
      .select()
      .single()

    if (trackError) throw trackError

    const position = await nextPlaylistPosition(playlistId)
    const { error: itemError } = await supabase
      .from('music_playlist_items')
      .insert({ playlist_id: playlistId, track_id: track.id, position })

    if (itemError) throw itemError
    return mapTrack(track, playlistId, position)
  },

  async deleteTrack(track: MusicTrack): Promise<void> {
    const { error: itemError } = await supabase
      .from('music_playlist_items')
      .delete()
      .eq('track_id', track.id)

    if (itemError) throw itemError

    const { error: trackError } = await supabase
      .from('music_tracks')
      .delete()
      .eq('id', track.id)

    if (trackError) throw trackError

    if (track.file_path) {
      const { error: storageError } = await supabase.storage
        .from('music-audio')
        .remove([track.file_path])
      if (storageError) console.warn('Storage delete error:', storageError)
    }
  },
}

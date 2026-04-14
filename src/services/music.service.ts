import { supabase } from '@/lib/supabase'
import { MusicPlaylist, MusicTrack, MusicSchedule } from '@/types/music'

export const musicService = {
  // ── PLAYLISTS ──
  async getPlaylists(businessId: string) {
    const { data, error } = await supabase
      .from('music_playlists')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as MusicPlaylist[]
  },

  async createPlaylist(playlist: Partial<MusicPlaylist>) {
    const { data, error } = await supabase
      .from('music_playlists')
      .insert(playlist)
      .select()
      .single()
    if (error) throw error
    return data as MusicPlaylist
  },

  async updatePlaylist(id: string, updates: Partial<MusicPlaylist>) {
    const { data, error } = await supabase
      .from('music_playlists')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as MusicPlaylist
  },

  async deletePlaylist(id: string) {
    const { error } = await supabase.from('music_playlists').delete().eq('id', id)
    if (error) throw error
  },

  // ── TRACKS ──
  async getTracksByPlaylist(playlistId: string) {
    const { data, error } = await supabase
      .from('music_tracks')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('order_index', { ascending: true })
    if (error) throw error
    return data as MusicTrack[]
  },

  async uploadTrack(
    businessId: string, 
    playlistId: string, 
    file: File, 
    metadata: { title: string, artist?: string, duration?: number }
  ) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${businessId}/${Date.now()}.${fileExt}`
    const filePath = `tracks/${fileName}`

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('music-tracks')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('music-tracks')
      .getPublicUrl(filePath)

    // 3. Save to DB
    const { data, error: dbError } = await supabase
      .from('music_tracks')
      .insert({
        business_id: businessId,
        playlist_id: playlistId,
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
        file_path: filePath,
        file_url: publicUrl,
        order_index: 0 // Ideally set based on current count
      })
      .select()
      .single()

    if (dbError) throw dbError
    return data as MusicTrack
  },

  async deleteTrack(track: MusicTrack) {
    // 1. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from('music-tracks')
      .remove([track.file_path])
    
    if (storageError) console.warn('Storage delete error:', storageError)

    // 2. Delete from DB
    const { error: dbError } = await supabase
      .from('music_tracks')
      .delete()
      .eq('id', track.id)
    
    if (dbError) throw dbError
  },

  // ── SCHEDULES ──
  async getSchedules(businessId: string) {
    const { data, error } = await supabase
      .from('music_schedules')
      .select('*, music_playlists(name)')
      .eq('business_id', businessId)
    if (error) throw error
    return data as (MusicSchedule & { music_playlists: { name: string } })[]
  },

  async createSchedule(schedule: Partial<MusicSchedule>) {
    const { data, error } = await supabase
      .from('music_schedules')
      .insert(schedule)
      .select()
      .single()
    if (error) throw error
    return data as MusicSchedule
  },

  async deleteSchedule(id: string) {
    const { error } = await supabase.from('music_schedules').delete().eq('id', id)
    if (error) throw error
  }
}

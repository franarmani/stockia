export interface MusicPlaylist {
  id: string
  business_id: string
  name: string
  description: string | null
  mood: string | null
  category: string | null
  cover_url: string | null
  is_active: boolean
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface MusicTrack {
  id: string
  playlist_id: string
  business_id: string
  title: string
  artist: string | null
  file_url: string
  file_path: string | null
  youtube_id: string | null
  duration: number | null
  order_index: number
  created_at: string
}

export interface MusicSchedule {
  id: string
  business_id: string
  playlist_id: string
  day_of_week: number // 0-6
  start_time: string // HH:mm:ss
  end_time: string // HH:mm:ss
  is_active: boolean
  created_at: string
}

export interface MusicPlayerState {
  currentPlaylist: MusicPlaylist | null
  currentTrack: MusicTrack | null
  queue: MusicTrack[]
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  isExpanded: boolean
  shuffle: boolean
  repeatMode: 'none' | 'one' | 'all'
}

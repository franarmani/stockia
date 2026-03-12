// src/stores/musicPlayerStore.ts
// Global music player state — audio lives here so it persists across navigation

import { create } from 'zustand'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { resumeAudioContext } from '@/lib/music/audioContext'
import {
  fetchMusicCatalog,
  getTrackSignedUrl,
  savePlaybackState,
  getCoverUrl,
  type MusicTrackMeta,
  type MusicPlaylist,
  type MusicAccess,
} from '@/lib/music/api'

// ─── Track with runtime info ────────────────────────────────────────────────

export interface PlayerTrack extends MusicTrackMeta {
  coverUrl: string | null
  // signed URL info
  signedUrl: string | null
  signedUrlExpiresAt: number | null // epoch ms
}

export type RepeatMode = 'off' | 'one' | 'all'

// ─── Store interface ────────────────────────────────────────────────────────

interface MusicPlayerState {
  // Audio element (singleton, mounted once in GlobalMusicPlayer)
  audioRef: HTMLAudioElement | null
  setAudioRef: (el: HTMLAudioElement) => void

  // Catalog
  playlists: MusicPlaylist[]
  access: MusicAccess
  catalogLoaded: boolean
  catalogLoading: boolean
  loadCatalog: () => Promise<void>

  // Queue
  activePlaylistId: string | null
  queue: PlayerTrack[]
  currentIndex: number
  currentTrack: PlayerTrack | null

  // Transport
  isPlaying: boolean
  currentTime: number
  duration: number
  buffering: boolean

  // Settings
  volume: number
  muted: boolean
  shuffle: boolean
  repeatMode: RepeatMode

  // Actions
  loadPlaylist: (playlistId: string, trackId?: string) => Promise<void>
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setShuffle: (v: boolean) => void
  toggleShuffle: () => void
  setRepeatMode: (m: RepeatMode) => void
  cycleRepeat: () => void

  // Internal
  _ensureSignedUrl: (track: PlayerTrack) => Promise<string>
  _playTrack: (index: number) => Promise<void>
  _setCurrentTime: (t: number) => void
  _setDuration: (t: number) => void
  _setBuffering: (v: boolean) => void
  _onEnded: () => void
  _persistState: () => void
  _persistTimer: ReturnType<typeof setTimeout> | null
  _schedulePersist: () => void
}

// ─── Utility ────────────────────────────────────────────────────────────────

function buildQueue(playlist: MusicPlaylist): PlayerTrack[] {
  return [...playlist.music_playlist_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      ...item.music_tracks,
      coverUrl: getCoverUrl(item.music_tracks.cover_path),
      signedUrl: null,
      signedUrlExpiresAt: null,
    }))
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SIGNED_URL_BUFFER_MS = 30_000 // refresh 30s before expiry
const PERSIST_DEBOUNCE_MS = 15_000  // save state every 15s at most

// ─── Store ──────────────────────────────────────────────────────────────────

export const useMusicPlayer = create<MusicPlayerState>((set, get) => ({
  audioRef: null,
  setAudioRef: (el) => set({ audioRef: el }),

  playlists: [],
  access: { enabled: false, plan_tier: 'free' },
  catalogLoaded: false,
  catalogLoading: false,

  activePlaylistId: null,
  queue: [],
  currentIndex: -1,
  currentTrack: null,

  isPlaying: false,
  currentTime: 0,
  duration: 0,
  buffering: false,

  volume: 0.8,
  muted: false,
  shuffle: false,
  repeatMode: 'off',

  _persistTimer: null,

  // ── Load catalog ──────────────────────────────────────────────────────────

  loadCatalog: async () => {
    if (get().catalogLoading) return
    set({ catalogLoaded: false }) // allow re-fetch

    // Need business_id from auth profile
    const profile = useAuthStore.getState().profile
    if (!profile?.business_id) {
      console.warn('[Music] loadCatalog: no business_id available yet')
      return
    }

    set({ catalogLoading: true })
    try {
      const data = await fetchMusicCatalog(profile.business_id)
      const state = data.playbackState

      set({
        playlists: data.playlists,
        access: data.access,
        catalogLoaded: true,
        catalogLoading: false,
        ...(state && {
          volume: state.volume,
          muted: state.is_muted,
          shuffle: state.shuffle,
          repeatMode: state.repeat_mode as RepeatMode,
        }),
      })

      // Restore last played playlist/track (don't auto-play)
      if (state?.active_playlist_id && data.access.enabled) {
        const playlist = data.playlists.find((p) => p.id === state.active_playlist_id)
        if (playlist) {
          const q = buildQueue(playlist)
          const idx = state.current_track_id
            ? q.findIndex((t) => t.id === state.current_track_id)
            : 0
          set({
            activePlaylistId: playlist.id,
            queue: q,
            currentIndex: Math.max(0, idx),
            currentTrack: q[Math.max(0, idx)] ?? null,
          })
          // Restore position without playing
          const audio = get().audioRef
          if (audio && state.current_time_sec > 0) {
            audio.currentTime = state.current_time_sec
          }
        }
      }
    } catch (err: any) {
      set({ catalogLoading: false })
      // Don't toast here — catalog might fail if music not enabled
      console.warn('[Music] catalog load failed:', err.message)
    }
  },

  // ── Load playlist ─────────────────────────────────────────────────────────

  loadPlaylist: async (playlistId, trackId) => {
    // Resume AudioContext *synchronously* while still in the user-gesture call stack
    resumeAudioContext()

    const { playlists, shuffle: doShuffle } = get()
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) return

    let q = buildQueue(playlist)

    // Find the clicked track's position before any shuffle
    let startIdx = trackId ? Math.max(0, q.findIndex((t) => t.id === trackId)) : 0

    if (doShuffle) {
      // Move the clicked track to front, shuffle the rest — Spotify behavior
      const [clicked] = q.splice(startIdx, 1)
      q = shuffleArray(q)
      if (clicked) q.unshift(clicked)
      startIdx = 0
    }

    set({ activePlaylistId: playlistId, queue: q, currentIndex: startIdx })
    await get()._playTrack(startIdx)
  },

  // ── Transport controls ────────────────────────────────────────────────────

  play: () => {
    // Resume AudioContext *synchronously* while still in the user-gesture call stack
    resumeAudioContext()
    const { audioRef, currentTrack } = get()
    if (!audioRef || !currentTrack) return
    audioRef.play().catch(() => {})
    set({ isPlaying: true })
  },

  pause: () => {
    const { audioRef } = get()
    audioRef?.pause()
    set({ isPlaying: false })
    get()._persistState()
  },

  togglePlay: () => {
    const { isPlaying } = get()
    if (isPlaying) get().pause()
    else get().play()
  },

  next: () => {
    const { queue, currentIndex, repeatMode } = get()
    if (!queue.length) return
    let next = currentIndex + 1
    if (next >= queue.length) {
      if (repeatMode === 'all') next = 0
      else { get().pause(); return }
    }
    get()._playTrack(next)
  },

  prev: () => {
    const { queue, currentIndex, audioRef } = get()
    if (!queue.length) return
    // If >3s in, restart; else go to previous
    if (audioRef && audioRef.currentTime > 3) {
      audioRef.currentTime = 0
      return
    }
    const prev = currentIndex > 0 ? currentIndex - 1 : queue.length - 1
    get()._playTrack(prev)
  },

  seek: (time) => {
    const { audioRef } = get()
    if (!audioRef) return
    audioRef.currentTime = time
    set({ currentTime: time })
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v))
    const { audioRef } = get()
    if (audioRef) audioRef.volume = vol
    set({ volume: vol, muted: vol === 0 })
    get()._schedulePersist()
  },

  toggleMute: () => {
    const { muted, audioRef, volume } = get()
    const newMuted = !muted
    if (audioRef) audioRef.muted = newMuted
    set({ muted: newMuted })
    // If unmuting at 0 volume, bump to 0.5
    if (!newMuted && volume === 0) {
      get().setVolume(0.5)
      return
    }
    get()._schedulePersist()
  },

  setShuffle: (v) => {
    set({ shuffle: v })
    get()._schedulePersist()
  },

  toggleShuffle: () => get().setShuffle(!get().shuffle),

  setRepeatMode: (m) => {
    set({ repeatMode: m })
    get()._schedulePersist()
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const cur = get().repeatMode
    const next = modes[(modes.indexOf(cur) + 1) % modes.length]
    get().setRepeatMode(next)
  },

  // ── Internal ──────────────────────────────────────────────────────────────

  _ensureSignedUrl: async (track) => {
    // Local public paths don't need a signed URL — serve directly
    if (track.audio_path.startsWith('/') || track.audio_path.startsWith('http')) {
      // Encode each path segment so spaces/special chars work in the browser
      const encoded = track.audio_path
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/')
      return encoded
    }

    const now = Date.now()
    if (track.signedUrl && track.signedUrlExpiresAt && track.signedUrlExpiresAt - now > SIGNED_URL_BUFFER_MS) {
      return track.signedUrl
    }

    const result = await getTrackSignedUrl(track.id, track.audio_path)
    const expiresAt = now + result.expires_in * 1000

    // Update in queue
    set((s) => ({
      queue: s.queue.map((t) =>
        t.id === track.id
          ? { ...t, signedUrl: result.url, signedUrlExpiresAt: expiresAt }
          : t
      ),
      currentTrack:
        s.currentTrack?.id === track.id
          ? { ...s.currentTrack, signedUrl: result.url, signedUrlExpiresAt: expiresAt }
          : s.currentTrack,
    }))

    return result.url
  },

  _playTrack: async (index) => {
    const { queue, audioRef, volume, muted, repeatMode } = get()
    const track = queue[index]
    if (!track || !audioRef) return

    set({ currentIndex: index, currentTrack: track, buffering: true, currentTime: 0 })
    audioRef.pause()
    audioRef.src = ''

    try {
      const url = await get()._ensureSignedUrl(track)
      audioRef.src = url
      audioRef.volume = volume
      audioRef.muted = muted
      audioRef.load()

      // Set up ended listener
      const handleEnded = () => get()._onEnded()
      audioRef.removeEventListener('ended', handleEnded)
      audioRef.addEventListener('ended', handleEnded, { once: true })

      // Prefetch next track URL in background (~after 5s)
      const nextIdx = (index + 1) % queue.length
      if (nextIdx !== index) {
        setTimeout(() => {
          const next = get().queue[nextIdx]
          if (next) get()._ensureSignedUrl(next).catch(() => {})
        }, 5_000)
      }

      await audioRef.play()
      set({ isPlaying: true, buffering: false })
    } catch (err: any) {
      set({ isPlaying: false, buffering: false })
      // AbortError = play() was interrupted because we switched tracks — ignore silently
      if (err?.name === 'AbortError') return
      console.warn('[Music] playback error:', track.title, err?.message)
      if (repeatMode !== 'one') {
        toast.error(`No se pudo reproducir: ${track.title}`)
      }
    }
  },

  _onEnded: () => {
    const { repeatMode, queue, currentIndex } = get()
    if (repeatMode === 'one') {
      get()._playTrack(currentIndex)
      return
    }
    const next = currentIndex + 1
    if (next < queue.length) {
      get()._playTrack(next)
    } else if (repeatMode === 'all') {
      get()._playTrack(0)
    } else {
      set({ isPlaying: false })
      get()._persistState()
    }
  },

  _setCurrentTime: (t) => {
    set({ currentTime: t })
    // Prefetch next track when ~20s remain
    const { duration, queue, currentIndex } = get()
    if (duration > 0 && duration - t < 20) {
      const nextIdx = (currentIndex + 1) % queue.length
      const next = queue[nextIdx]
      if (next && !next.signedUrl) {
        get()._ensureSignedUrl(next).catch(() => {})
      }
    }
  },

  _setDuration: (t) => set({ duration: t }),
  _setBuffering: (v) => set({ buffering: v }),

  _persistState: () => {
    const profile = useAuthStore.getState().profile
    if (!profile?.business_id) return
    const { activePlaylistId, currentTrack, currentTime, volume, muted, shuffle, repeatMode } = get()
    savePlaybackState(profile.business_id, {
      active_playlist_id: activePlaylistId,
      current_track_id: currentTrack?.id ?? null,
      current_time_sec: Math.floor(currentTime),
      volume,
      is_muted: muted,
      shuffle,
      repeat_mode: repeatMode,
    }).catch(() => {})
  },

  _schedulePersist: () => {
    const { _persistTimer } = get()
    if (_persistTimer) clearTimeout(_persistTimer)
    const timer = setTimeout(() => get()._persistState(), PERSIST_DEBOUNCE_MS)
    set({ _persistTimer: timer })
  },
}))

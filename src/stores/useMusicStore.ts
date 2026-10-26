import { create } from 'zustand'
import { MusicPlaylist, MusicTrack } from '@/types/music'
import { resolveTrackUrl } from '@/features/music/musicDownload'

interface MusicStore {
  // State
  currentPlaylist: MusicPlaylist | null
  currentTrack: MusicTrack | null
  queue: MusicTrack[]
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  isExpanded: boolean
  shuffle: boolean
  playbackSource: 'file' | 'youtube'

  // Internal Audio Element
  audio: HTMLAudioElement | null

  // Actions
  initAudio: () => void
  setPlaylist: (playlist: MusicPlaylist, tracks: MusicTrack[], shouldPlay?: boolean) => void
  playTrack: (track: MusicTrack) => void
  stopPlayback: () => void
  togglePlay: () => void
  nextTrack: () => void
  prevTrack: () => void
  setVolume: (volume: number) => void
  seekTo: (time: number) => void
  setExpanded: (expanded: boolean) => void
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  currentPlaylist: null,
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 0.7,
  currentTime: 0,
  duration: 0,
  isExpanded: false,
  shuffle: false,
  playbackSource: 'file',
  audio: null,

  initAudio: () => {
    if (get().audio) return
    
    const audio = new Audio()
    audio.volume = get().volume
    
    audio.addEventListener('timeupdate', () => {
      set({ currentTime: audio.currentTime })
    })

    audio.addEventListener('loadedmetadata', () => {
      set({ duration: audio.duration })
    })

    audio.addEventListener('ended', () => {
      get().nextTrack()
    })

    set({ audio })
  },

  setPlaylist: (playlist, tracks, shouldPlay = true) => {
    set({ currentPlaylist: playlist, queue: tracks })
    if (shouldPlay && tracks.length > 0) {
      get().playTrack(tracks[0])
    }
  },

  playTrack: (track) => {
    const { audio, initAudio } = get()
    const source = track.youtube_id ? 'youtube' : 'file'
    set({ playbackSource: source, currentTrack: track, isPlaying: true })

    if (source === 'file') {
      if (!audio) initAudio()
      const player = get().audio!
      resolveTrackUrl(track.file_url).then(src => {
        // Si mientras tanto eligieron otra canción, no la pisamos.
        if (get().currentTrack?.id !== track.id) return
        player.src = src
        player.play()
      })
    } else {
      // YouTube source: The YouTubePlayer component will react to store changes
      // Ensure local audio is paused
      if (audio) audio.pause()
    }
  },

  stopPlayback: () => {
    const { audio } = get()
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    set({
      currentPlaylist: null,
      currentTrack: null,
      queue: [],
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isExpanded: false,
    })
  },

  togglePlay: () => {
    const { audio, isPlaying, playbackSource } = get()
    
    if (playbackSource === 'file' && audio) {
      if (isPlaying) audio.pause()
      else audio.play()
    }
    
    set({ isPlaying: !isPlaying })
  },

  nextTrack: () => {
    const { queue, currentTrack } = get()
    if (queue.length === 0 || !currentTrack) return

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % queue.length
    get().playTrack(queue[nextIndex])
  },

  prevTrack: () => {
    const { queue, currentTrack, audio, playbackSource } = get()
    if (queue.length === 0 || !currentTrack) return

    // If more than 3 seconds in, restart track
    if (playbackSource === 'file' && audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length
    get().playTrack(queue[prevIndex])
  },

  setVolume: (val) => {
    const { audio } = get()
    if (audio) audio.volume = val
    set({ volume: val })
  },

  seekTo: (time) => {
    const { audio, playbackSource } = get()
    if (playbackSource === 'file' && audio) {
      audio.currentTime = time
    }
    set({ currentTime: time })
  },

  setExpanded: (isExpanded) => set({ isExpanded })
}))

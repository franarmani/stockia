import { create } from 'zustand'
import { MusicPlaylist, MusicTrack } from '@/types/music'

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

  // Internal Audio Element
  audio: HTMLAudioElement | null

  // Actions
  initAudio: () => void
  setPlaylist: (playlist: MusicPlaylist, tracks: MusicTrack[]) => void
  playTrack: (track: MusicTrack) => void
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

  setPlaylist: (playlist, tracks) => {
    set({ currentPlaylist: playlist, queue: tracks })
    if (tracks.length > 0) {
      get().playTrack(tracks[0])
    }
  },

  playTrack: (track) => {
    const { audio, initAudio } = get()
    if (!audio) {
      initAudio()
      // Re-fetch audio after init
      const newAudio = get().audio!
      newAudio.src = track.file_url
      newAudio.play()
    } else {
      audio.src = track.file_url
      audio.play()
    }
    set({ currentTrack: track, isPlaying: true })
  },

  togglePlay: () => {
    const { audio, isPlaying } = get()
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
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
    const { queue, currentTrack, audio } = get()
    if (queue.length === 0 || !currentTrack) return

    // If more than 3 seconds in, restart track
    if (audio && audio.currentTime > 3) {
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
    const { audio } = get()
    if (audio) audio.currentTime = time
    set({ currentTime: time })
  },

  setExpanded: (isExpanded) => set({ isExpanded })
}))

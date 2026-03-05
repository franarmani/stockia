// src/components/music/GlobalMusicPlayer.tsx
// Invisible component that mounts the audio element once and wires up store events.
// Must be rendered inside AppShellLauncher so it survives navigation.

import { useEffect, useRef } from 'react'
import { useMusicPlayer } from '@/stores/musicPlayerStore'
import { useAuthStore } from '@/stores/authStore'

export default function GlobalMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const setAudioRef   = useMusicPlayer((s) => s.setAudioRef)
  const _setCurrentTime = useMusicPlayer((s) => s._setCurrentTime)
  const _setDuration    = useMusicPlayer((s) => s._setDuration)
  const _setBuffering   = useMusicPlayer((s) => s._setBuffering)
  const _persistState   = useMusicPlayer((s) => s._persistState)
  const loadCatalog     = useMusicPlayer((s) => s.loadCatalog)
  const catalogLoaded   = useMusicPlayer((s) => s.catalogLoaded)
  const catalogLoading  = useMusicPlayer((s) => s.catalogLoading)

  // Watch profile — load catalog as soon as business_id is available
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.crossOrigin = 'anonymous'
    audioRef.current = audio
    setAudioRef(audio)

    const onTime      = () => _setCurrentTime(audio.currentTime)
    const onMeta      = () => _setDuration(audio.duration)
    const onWaiting   = () => _setBuffering(true)
    const onCanPlay   = () => _setBuffering(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('playing', onCanPlay)

    // Persist state on page unload
    const onUnload = () => _persistState()
    window.addEventListener('beforeunload', onUnload)

    // Auto-reload signed URL on error (expired URL)
    const onError = () => {
      const store = useMusicPlayer.getState()
      const track = store.currentTrack
      if (track) {
        // Invalidate cached URL so _ensureSignedUrl re-fetches
        useMusicPlayer.setState((s) => ({
          queue: s.queue.map((t) =>
            t.id === track.id ? { ...t, signedUrl: null, signedUrlExpiresAt: null } : t
          ),
          currentTrack: s.currentTrack?.id === track.id
            ? { ...s.currentTrack, signedUrl: null, signedUrlExpiresAt: null }
            : s.currentTrack,
        }))
        store._playTrack(store.currentIndex)
      }
    }
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('playing', onCanPlay)
      audio.removeEventListener('error', onError)
      window.removeEventListener('beforeunload', onUnload)
      audio.pause()
      audio.src = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load catalog once we have a profile + not yet loaded
  useEffect(() => {
    if (!catalogLoaded && !catalogLoading && profile?.business_id) {
      loadCatalog()
    }
  }, [catalogLoaded, catalogLoading, loadCatalog, profile?.business_id])

  return null
}

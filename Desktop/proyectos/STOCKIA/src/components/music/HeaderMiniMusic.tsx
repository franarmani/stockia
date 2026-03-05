// src/components/music/HeaderMiniMusic.tsx
// Compact music player shown in the app header when music is available.
// Desktop: spectrum + title/artist + prev/play/next + volume + mute + open button
// Mobile: play/pause + title + open button (spectrum hidden on xs)

import { useNavigate } from 'react-router-dom'
import { useMusicPlayer } from '@/stores/musicPlayerStore'
import MiniSpectrumCanvas from './MiniSpectrumCanvas'
import {
  Play, Pause, SkipForward, Volume2, VolumeX, Music2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function HeaderMiniMusic() {
  const navigate = useNavigate()

  const audioRef    = useMusicPlayer((s) => s.audioRef)
  const currentTrack = useMusicPlayer((s) => s.currentTrack)
  const isPlaying   = useMusicPlayer((s) => s.isPlaying)
  const buffering   = useMusicPlayer((s) => s.buffering)
  const volume      = useMusicPlayer((s) => s.volume)
  const muted       = useMusicPlayer((s) => s.muted)
  const access      = useMusicPlayer((s) => s.access)

  const togglePlay  = useMusicPlayer((s) => s.togglePlay)
  const next        = useMusicPlayer((s) => s.next)
  const setVolume   = useMusicPlayer((s) => s.setVolume)
  const toggleMute  = useMusicPlayer((s) => s.toggleMute)

  // Don't render if no music access or no track loaded
  if (!access.enabled || !currentTrack) return null

  return (
    <div className="flex items-center gap-1.5 min-w-0 shrink-0">
      {/* Separator */}
      <div className="w-px h-5 bg-white/15 mx-1 hidden sm:block" />

      {/* Spectrum (hidden on mobile) */}
      <div className="hidden md:flex items-center">
        <MiniSpectrumCanvas
          audioRef={audioRef}
          isPlaying={isPlaying && !buffering}
          width={72}
          height={22}
        />
      </div>

      {/* Track info */}
      <div
        onClick={() => navigate('/music')}
        className="hidden sm:flex flex-col leading-none min-w-0 max-w-[120px] cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-[11px] font-semibold text-white/90 truncate leading-tight">
          {currentTrack.title}
        </span>
        {currentTrack.artist && (
          <span className="text-[9px] text-white/40 truncate leading-tight mt-0.5">
            {currentTrack.artist}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={buffering}
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
            'bg-primary/20 border border-primary/30 text-primary',
            'hover:bg-primary/30 active:scale-95',
            buffering && 'opacity-50 cursor-wait'
          )}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {buffering ? (
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={next}
          className="hidden sm:flex w-6 h-6 rounded-md items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 transition"
          title="Siguiente"
        >
          <SkipForward className="w-3 h-3" />
        </button>
      </div>

      {/* Volume (desktop only) */}
      <div className="hidden lg:flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white/80 transition"
          title={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted || volume === 0 ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-14 h-0.5 accent-primary cursor-pointer"
          title="Volumen"
        />
      </div>

      {/* Open Music page button */}
      <button
        onClick={() => navigate('/music')}
        className="hidden sm:flex w-6 h-6 rounded-md items-center justify-center text-white/40 hover:text-primary hover:bg-primary/10 transition"
        title="Abrir Música"
      >
        <Music2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

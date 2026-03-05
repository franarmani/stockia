// src/components/music/NowPlayingPanel.tsx
// Right-side "Now Playing" panel for the /music page.
// Shows cover, title, spectrum, progress bar, full controls.

import { useCallback } from 'react'
import { useMusicPlayer } from '@/stores/musicPlayerStore'
import BigSpectrumCanvas from './BigSpectrumCanvas'
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, Maximize2, Music,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  onFullscreen: () => void
}

export default function NowPlayingPanel({ onFullscreen }: Props) {
  const audioRef    = useMusicPlayer((s) => s.audioRef)
  const track       = useMusicPlayer((s) => s.currentTrack)
  const isPlaying   = useMusicPlayer((s) => s.isPlaying)
  const buffering   = useMusicPlayer((s) => s.buffering)
  const currentTime = useMusicPlayer((s) => s.currentTime)
  const duration    = useMusicPlayer((s) => s.duration)
  const volume      = useMusicPlayer((s) => s.volume)
  const muted       = useMusicPlayer((s) => s.muted)
  const shuffle     = useMusicPlayer((s) => s.shuffle)
  const repeatMode  = useMusicPlayer((s) => s.repeatMode)

  const togglePlay   = useMusicPlayer((s) => s.togglePlay)
  const next         = useMusicPlayer((s) => s.next)
  const prev         = useMusicPlayer((s) => s.prev)
  const seek         = useMusicPlayer((s) => s.seek)
  const setVolume    = useMusicPlayer((s) => s.setVolume)
  const toggleMute   = useMusicPlayer((s) => s.toggleMute)
  const toggleShuffle = useMusicPlayer((s) => s.toggleShuffle)
  const cycleRepeat  = useMusicPlayer((s) => s.cycleRepeat)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }, [seek])

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white/20">
        <Music className="w-16 h-16" />
        <p className="text-sm">Seleccioná una lista de canciones para comenzar</p>
      </div>
    )
  }

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat

  return (
    <div className="flex flex-col h-full gap-4 select-none">
      {/* Cover */}
      <div className="relative mx-auto w-full max-w-[220px] aspect-square rounded-2xl overflow-hidden bg-white/10 shadow-2xl shadow-black/40 flex-shrink-0">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-16 h-16 text-white/15" />
          </div>
        )}
        {/* Subtle glow */}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
      </div>

      {/* Track info */}
      <div className="text-center min-w-0 px-2">
        <h2 className="text-[15px] font-bold text-white truncate">{track.title}</h2>
        {track.artist && (
          <p className="text-[12px] text-white/50 mt-0.5 truncate">{track.artist}</p>
        )}
        {track.genre && (
          <span className="inline-block mt-1.5 text-[9px] uppercase tracking-widest font-semibold text-primary/70 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
            {track.genre}
          </span>
        )}
      </div>

      {/* Spectrum */}
      <BigSpectrumCanvas
        audioRef={audioRef}
        isPlaying={isPlaying && !buffering}
        className="h-[80px] rounded-xl overflow-hidden"
      />

      {/* Progress bar */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-white/35 tabular-nums w-8 text-right">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 h-1 group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          {/* Track */}
          <div className="absolute inset-y-0 left-0 right-0 my-auto h-1 rounded-full bg-white/10" />
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 my-auto h-1 rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <span className="text-[10px] text-white/35 tabular-nums w-8">
          {formatTime(duration)}
        </span>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Shuffle */}
        <button
          onClick={toggleShuffle}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition',
            shuffle
              ? 'text-primary bg-primary/15 border border-primary/30'
              : 'text-white/35 hover:text-white/70 hover:bg-white/10'
          )}
          title="Aleatorio"
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>

        {/* Prev */}
        <button
          onClick={prev}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition active:scale-90"
          title="Anterior"
        >
          <SkipBack className="w-4.5 h-4.5 fill-current" />
        </button>

        {/* Play / Pause — big button */}
        <button
          onClick={togglePlay}
          disabled={buffering}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            'bg-primary text-white border-0 transition-all active:scale-90',
            'hover:bg-primary/90 hover:shadow-primary/40 hover:shadow-xl',
            buffering && 'opacity-60 cursor-wait'
          )}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {buffering ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={next}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition active:scale-90"
          title="Siguiente"
        >
          <SkipForward className="w-4.5 h-4.5 fill-current" />
        </button>

        {/* Repeat */}
        <button
          onClick={cycleRepeat}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition',
            repeatMode !== 'off'
              ? 'text-primary bg-primary/15 border border-primary/30'
              : 'text-white/35 hover:text-white/70 hover:bg-white/10'
          )}
          title={`Repetir: ${repeatMode}`}
        >
          <RepeatIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Volume row */}
      <div className="flex items-center gap-2 px-2 mt-auto">
        <button
          onClick={toggleMute}
          className="text-white/40 hover:text-white/80 transition flex-shrink-0"
        >
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-primary cursor-pointer"
          title="Volumen"
        />

        {/* Fullscreen button */}
        <button
          onClick={onFullscreen}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition flex-shrink-0"
          title="Modo mostrador"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

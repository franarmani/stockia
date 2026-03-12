// src/components/music/NowPlayingPanel.tsx
// Spotify-inspired Now Playing panel — large cover, white play button, custom seek bar.

import { useCallback } from 'react'
import { useMusicPlayer } from '@/stores/musicPlayerStore'
import { trackGradient } from '@/lib/utils'
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
  const track       = useMusicPlayer((s) => s.currentTrack)
  const isPlaying   = useMusicPlayer((s) => s.isPlaying)
  const buffering   = useMusicPlayer((s) => s.buffering)
  const currentTime = useMusicPlayer((s) => s.currentTime)
  const duration    = useMusicPlayer((s) => s.duration)
  const volume      = useMusicPlayer((s) => s.volume)
  const muted       = useMusicPlayer((s) => s.muted)
  const shuffle     = useMusicPlayer((s) => s.shuffle)
  const repeatMode  = useMusicPlayer((s) => s.repeatMode)

  const togglePlay    = useMusicPlayer((s) => s.togglePlay)
  const next          = useMusicPlayer((s) => s.next)
  const prev          = useMusicPlayer((s) => s.prev)
  const seek          = useMusicPlayer((s) => s.seek)
  const setVolume     = useMusicPlayer((s) => s.setVolume)
  const toggleMute    = useMusicPlayer((s) => s.toggleMute)
  const toggleShuffle = useMusicPlayer((s) => s.toggleShuffle)
  const cycleRepeat   = useMusicPlayer((s) => s.cycleRepeat)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }, [seek])

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-white/20 select-none">
        <div className="w-full aspect-square rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <Music className="w-1/4 h-1/4" />
        </div>
        <p className="text-sm text-center leading-relaxed">
          Seleccioná una canción<br />para comenzar
        </p>
      </div>
    )
  }

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat
  const grad = trackGradient(track.id)

  return (
    <div className="flex flex-col gap-5 select-none">

      {/* ── Album art ── */}
      <div className="group relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/50 shrink-0">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
          >
            <span className="text-white/40 font-black text-6xl select-none leading-none">
              {track.title[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        <button
          onClick={onFullscreen}
          className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Modo mostrador"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Track info ── */}
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-white truncate leading-snug">{track.title}</p>
          <p className="text-[13px] text-white/50 mt-0.5 truncate">
            {track.artist ?? (track.genre ? `#${track.genre}` : '\u2014')}
          </p>
        </div>
        {track.genre && track.artist && (
          <span className="shrink-0 mt-1 text-[9px] uppercase tracking-widest font-semibold text-primary/70 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
            {track.genre}
          </span>
        )}
      </div>

      {/* ── Seek bar ── */}
      <div className="flex flex-col gap-1 px-1">
        <div className="relative h-4 flex items-center group/seek cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="absolute left-0 right-0 h-1 rounded-full bg-white/15 transition-all duration-150" />
          <div
            className="absolute left-0 h-1 rounded-full bg-white group-hover/seek:bg-primary transition-colors duration-150"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none z-20"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-white/35 tabular-nums">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-white/35 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── Transport controls ── */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={toggleShuffle}
          className={cn('relative p-2 rounded-full transition-colors', shuffle ? 'text-primary' : 'text-white/40 hover:text-white')}
          title="Aleatorio"
        >
          <Shuffle className="w-4.5 h-4.5" />
          {shuffle && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
        </button>

        <button onClick={prev} className="p-2 text-white/70 hover:text-white transition active:scale-90" title="Anterior">
          <SkipBack className="w-5.5 h-5.5 fill-current" />
        </button>

        {/* White Spotify-style play button */}
        <button
          onClick={togglePlay}
          disabled={buffering}
          className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-black/40 hover:scale-[1.06] active:scale-95 transition-transform disabled:opacity-50"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {buffering ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 fill-black text-black" />
          ) : (
            <Play className="w-6 h-6 fill-black text-black translate-x-0.5" />
          )}
        </button>

        <button onClick={next} className="p-2 text-white/70 hover:text-white transition active:scale-90" title="Siguiente">
          <SkipForward className="w-5.5 h-5.5 fill-current" />
        </button>

        <button
          onClick={cycleRepeat}
          className={cn('relative p-2 rounded-full transition-colors', repeatMode !== 'off' ? 'text-primary' : 'text-white/40 hover:text-white')}
          title={`Repetir: ${repeatMode}`}
        >
          <RepeatIcon className="w-4.5 h-4.5" />
          {repeatMode !== 'off' && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
        </button>
      </div>

      {/* ── Volume ── */}
      <div className="flex items-center gap-2 px-2">
        <button onClick={toggleMute} className="text-white/40 hover:text-white/80 transition shrink-0">
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <div className="relative flex-1 h-4 flex items-center group/vol cursor-pointer">
          <input
            type="range" min={0} max={1} step={0.02}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            title="Volumen"
          />
          <div className="absolute left-0 right-0 h-1 rounded-full bg-white/15" />
          <div
            className="absolute left-0 h-1 rounded-full bg-white/60 group-hover/vol:bg-primary transition-colors duration-150"
            style={{ width: `${(muted ? 0 : volume) * 100}%` }}
          />
        </div>
        <Volume2 className="w-4 h-4 text-white/20 shrink-0" />
      </div>

    </div>
  )
}

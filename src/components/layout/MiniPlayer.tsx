import { useMusicStore } from '@/stores/useMusicStore'
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

export default function MiniPlayer() {
  const { pathname } = useLocation()
  const { 
    currentTrack, 
    isPlaying, 
    togglePlay, 
    nextTrack, 
    prevTrack, 
    currentTime, 
    duration, 
    seekTo,
    volume,
    setVolume,
    stopPlayback,
  } = useMusicStore()

  if (!currentTrack) return null
  const showCloseButton = !pathname.startsWith('/music')
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-[100] w-[calc(100%-1rem)] max-w-[760px] -translate-x-1/2 animate-slide-in-bottom transition-all duration-500 sm:bottom-4 sm:w-[calc(100%-2rem)]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a101d]/95 shadow-[0_22px_65px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div 
          className="absolute inset-x-0 top-0 h-1 cursor-pointer bg-white/[0.06]"
          onClick={(e) => {
            if (duration <= 0) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            seekTo((x / rect.width) * duration)
          }}
        >
          <div 
            className="h-full bg-primary transition-[width] duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/15 text-primary">
              <Music className={`h-4 w-4 ${isPlaying ? 'animate-pulse' : ''}`} />
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/60" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.17em] text-primary">Reproduciendo</p>
              <h4 className="truncate text-xs font-bold text-white">{currentTrack.title}</h4>
              <p className="mt-0.5 truncate text-[10px] text-white/35">{currentTrack.artist || 'Artista desconocido'}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button onClick={prevTrack} className="rounded-lg p-2 text-white/35 transition hover:bg-white/[0.05] hover:text-white active:scale-90" aria-label="Canción anterior">
              <SkipBack className="h-3.5 w-3.5 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0b1120] transition hover:scale-105 active:scale-90"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <button onClick={nextTrack} className="rounded-lg p-2 text-white/35 transition hover:bg-white/[0.05] hover:text-white active:scale-90" aria-label="Siguiente canción">
              <SkipForward className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>

          <div className="hidden min-w-0 items-center justify-end gap-3 sm:flex">
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold tabular-nums text-white/25">
              <span className="text-white/50">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="group/vol flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-white/30 transition-colors group-hover/vol:text-primary" />
              <div className="relative flex h-4 items-center">
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  aria-label="Volumen"
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>
            {showCloseButton && (
              <button
                onClick={stopPlayback}
                className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-white/35 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white active:scale-95"
                aria-label="Cerrar reproductor y detener música"
                title="Cerrar reproductor"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {showCloseButton && (
            <button
              onClick={stopPlayback}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white sm:hidden"
              aria-label="Cerrar reproductor y detener música"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

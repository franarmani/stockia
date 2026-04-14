import { useMusicStore } from '@/stores/useMusicStore'
import { Play, Pause, SkipForward, SkipBack, Volume2, Maximize2, Minimize2, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/Slider' // Assuming existence or I will create an inline one

export default function MiniPlayer() {
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
    setVolume
  } = useMusicStore()

  if (!currentTrack) return null

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[98%] max-w-[800px] z-[100] transition-all duration-700 ease-out animate-slide-in-bottom">
      <div className="glass-panel border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden rounded-2xl md:rounded-full bg-slate-950/40 backdrop-blur-xl">
        {/* Progress Bar - Ultra-slim attached to top */}
        <div 
          className="absolute top-0 left-0 right-0 h-[2px] bg-white/5 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const perc = x / rect.width
            seekTo(perc * duration)
          }}
        >
          <div 
            className="h-full bg-amber-500 transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="px-4 py-2 flex items-center justify-between gap-4 h-14 md:h-12">
          {/* Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/10">
              <Music className={cn("w-4 h-4 text-amber-500", isPlaying && "animate-pulse")} />
            </div>
            <div className="min-w-0 leading-tight">
              <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{currentTrack.title}</h4>
              <p className="text-[9px] font-bold text-white/30 truncate uppercase tracking-widest">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button onClick={prevTrack} className="p-2 text-white/20 hover:text-white transition-colors active:scale-90">
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center transition-all hover:scale-105 active:scale-90 shadow-lg shadow-amber-500/20"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={nextTrack} className="p-2 text-white/20 hover:text-white transition-colors active:scale-90">
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          {/* Volume & Time */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="flex items-center gap-1.5 text-[9px] font-black text-white/20 uppercase tracking-widest">
              <span className="text-amber-500/40">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <div className="flex items-center gap-2 group/vol relative">
              <Volume2 className="w-3.5 h-3.5 text-white/20 group-hover/vol:text-amber-500 transition-colors" />
              <div className="relative flex items-center h-4">
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]
                    hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                  style={{
                    background: `linear-gradient(to right, #f59e0b ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

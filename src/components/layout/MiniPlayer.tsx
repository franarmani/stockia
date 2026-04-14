import { useMusicStore } from '@/stores/useMusicStore'
import { Play, Pause, SkipForward, SkipBack, Volume2, Maximize2, Minimize2, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/Slider' // Assuming existence or I will create an inline one

export default function MiniPlayer() {
  const { 
    currentTrack, 
    currentPlaylist,
    isPlaying, 
    togglePlay, 
    nextTrack, 
    prevTrack, 
    currentTime, 
    duration, 
    seekTo,
    volume,
    setVolume,
    isExpanded,
    setExpanded
  } = useMusicStore()

  if (!currentTrack) return null

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn(
      "fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 transition-all duration-500",
      isExpanded ? "md:bottom-8" : "md:bottom-4"
    )}>
      <div className="glass-panel border-white/15 shadow-2xl overflow-hidden animate-slide-in-bottom">
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 cursor-pointer group" onClick={(e) => {
           const rect = e.currentTarget.getBoundingClientRect()
           const x = e.clientX - rect.left
           const perc = x / rect.width
           seekTo(perc * duration)
        }}>
          <div 
            className="h-full bg-primary transition-all shadow-[0_0_10px_rgba(29,185,84,0.5)]" 
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* Track Info */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20 relative group overflow-hidden">
                <Music className="w-5 h-5 text-primary" />
                <div className={cn(
                  "absolute inset-0 bg-primary/10 flex items-center justify-center",
                  isPlaying ? "animate-pulse" : ""
                )} />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[13px] font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-[11px] text-white/40 truncate">{currentTrack.artist || 'Desconocido'} · {currentPlaylist?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setExpanded(!isExpanded)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-1">
               <button onClick={prevTrack} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90">
                 <SkipBack className="w-4 h-4 fill-current" />
               </button>
               <button 
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-white text-slate-950 flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-lg shadow-white/10"
               >
                 {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
               </button>
               <button onClick={nextTrack} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90">
                 <SkipForward className="w-4 h-4 fill-current" />
               </button>
             </div>

             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-white/25 w-8">{formatTime(currentTime)}</span>
               <div className="hidden sm:flex items-center gap-2 group/vol relative">
                  <Volume2 className="w-3.5 h-3.5 text-white/30 group-hover/vol:text-white transition-colors" />
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                  />
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// src/components/music/PlaylistGrid.tsx
// Grid of playlist cards — Spotify-inspired dark glass style.

import { cn } from '@/lib/utils'
import { getCoverUrl, type MusicPlaylist } from '@/lib/music/api'
import { Music, Play } from 'lucide-react'

interface Props {
  playlists: MusicPlaylist[]
  activePlaylistId: string | null
  onSelect: (playlist: MusicPlaylist) => void
  loading?: boolean
}

export default function PlaylistGrid({ playlists, activePlaylistId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3 animate-pulse h-24" />
        ))}
      </div>
    )
  }

  if (!playlists.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-white/30">
        <Music className="w-8 h-8" />
        <p className="text-sm">No hay listas de canciones disponibles</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {playlists.map((pl) => {
        const coverUrl = getCoverUrl(pl.cover_path)
        const isActive = pl.id === activePlaylistId
        const trackCount = pl.music_playlist_items?.length ?? 0

        return (
          <button
            key={pl.id}
            onClick={() => onSelect(pl)}
            className={cn(
              'group relative flex flex-col items-start gap-2 p-3 rounded-xl text-left',
              'border transition-all duration-200',
              'hover:-translate-y-0.5 hover:shadow-xl active:scale-95',
              isActive
                ? 'bg-primary/15 border-primary/40 shadow-lg shadow-primary/10'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            )}
          >
            {/* Cover */}
            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt={pl.name} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-7 h-7 text-white/20" />
              )}
              {/* Play overlay */}
              <div className={cn(
                'absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity',
                'opacity-0 group-hover:opacity-100',
                isActive && 'opacity-100'
              )}>
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shadow-lg',
                  isActive ? 'bg-primary' : 'bg-white/90'
                )}>
                  <Play className={cn(
                    'w-4 h-4 fill-current translate-x-0.5',
                    isActive ? 'text-white' : 'text-black'
                  )} />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 w-full">
              <p className={cn(
                'text-[12px] font-semibold truncate leading-tight',
                isActive ? 'text-primary' : 'text-white/90'
              )}>
                {pl.name}
              </p>
              <p className="text-[10px] text-white/35 mt-0.5">
                {trackCount} {trackCount === 1 ? 'canción' : 'canciones'}
              </p>
            </div>

            {/* Active indicator */}
            {isActive && (
              <span className="absolute top-2 right-2 text-[8px] font-bold text-primary bg-primary/20 border border-primary/30 rounded-full px-1.5 py-0.5 leading-none">
                EN CURSO
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

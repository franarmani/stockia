// src/pages/music/MusicPage.tsx
// Premium /music page — playlists + now playing + fullscreen "modo mostrador"

import { useEffect, useRef, useState } from 'react'
import { useMusicPlayer } from '@/stores/musicPlayerStore'
import { useAuthStore } from '@/stores/authStore'
import NowPlayingPanel from '@/components/music/NowPlayingPanel'
import BigSpectrumCanvas from '@/components/music/BigSpectrumCanvas'
import MusicUploadModal from './MusicUploadModal'
import {
  Music2, Lock, Sparkles, Play, Pause, Volume2, VolumeX,
  Minimize2, ChevronLeft, ChevronRight, Music, Upload, RefreshCw, ListMusic,
  Layers, ArrowLeft, Shuffle,
} from 'lucide-react'
import { getCoverUrl, type MusicPlaylist } from '@/lib/music/api'
import { cn, trackGradient } from '@/lib/utils'

// Equalizer animation — 3 bars bouncing at different speeds
function Equalizer({ animate }: { animate: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4 w-4 shrink-0">
      {[0.6, 1, 0.7].map((delay, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 rounded-sm bg-primary',
            animate ? 'animate-[equalize_0.8s_ease-in-out_infinite_alternate]' : ''
          )}
          style={{
            height: animate ? `${50 + i * 20}%` : '30%',
            animationDelay: animate ? `${delay * 0.3}s` : '0s',
            transition: 'height 0.3s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Palette for category tiles ───────────────────────────────────────────────
const CATEGORY_PALETTES = [
  { from: '#1DB954', to: '#0a5c2b' },  // green
  { from: '#e91e8c', to: '#6b0040' },  // pink
  { from: '#2196f3', to: '#0d3460' },  // blue
  { from: '#ff6b35', to: '#7a2e00' },  // orange
  { from: '#9c27b0', to: '#3d0060' },  // purple
  { from: '#009688', to: '#004d40' },  // teal
  { from: '#f44336', to: '#7f0000' },  // red
  { from: '#ffc107', to: '#7a5800' },  // amber
]

// ─── Paywall ─────────────────────────────────────────────────────────────────

function MusicPaywall() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
        <Music2 className="w-8 h-8 text-primary" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Música Premium</h1>
        <p className="text-white/50 max-w-sm">
          Ambiente musical sin publicidad para tu local.
          Catálogo exclusivo licenciado para negocios.
        </p>
      </div>

      <ul className="text-left space-y-2 text-sm text-white/60 max-w-xs">
        {[
          '🎵 Catálogo propio — sin publicidad externa',
          '🔊 Player global que no se corta mientras trabajás',
          '📊 Espectro de audio en tiempo real',
          '🖥️ Modo mostrador en pantalla completa',
          '💾 Restaura la última canción automáticamente',
        ].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-base leading-tight">{f.split(' ')[0]}</span>
            <span>{f.split(' ').slice(1).join(' ')}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-semibold cursor-not-allowed select-none">
        <Lock className="w-4 h-4" />
        Activar Música Premium
        <Sparkles className="w-4 h-4" />
      </div>
      <p className="text-[11px] text-white/25">Contactá a tu administrador para activar</p>
    </div>
  )
}

// ─── Fullscreen "Modo Mostrador" overlay ─────────────────────────────────────

function ModoMostrador({ onExit }: { onExit: () => void }) {
  const audioRef    = useMusicPlayer((s) => s.audioRef)
  const track       = useMusicPlayer((s) => s.currentTrack)
  const isPlaying   = useMusicPlayer((s) => s.isPlaying)
  const buffering   = useMusicPlayer((s) => s.buffering)
  const volume      = useMusicPlayer((s) => s.volume)
  const muted       = useMusicPlayer((s) => s.muted)
  const togglePlay  = useMusicPlayer((s) => s.togglePlay)
  const next        = useMusicPlayer((s) => s.next)
  const prev        = useMusicPlayer((s) => s.prev)
  const setVolume   = useMusicPlayer((s) => s.setVolume)
  const toggleMute  = useMusicPlayer((s) => s.toggleMute)

  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = clock.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-[200] bg-[#07142f] flex flex-col items-center justify-center gap-6 px-8">
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition"
        title="Salir del modo mostrador"
      >
        <Minimize2 className="w-5 h-5" />
      </button>
      <p className="text-5xl font-thin text-white/20 tabular-nums tracking-[0.15em]">{timeStr}</p>
      {track && (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">{track.title}</h2>
          {track.artist && <p className="text-lg text-white/40 mt-1">{track.artist}</p>}
        </div>
      )}
      <div className="w-full max-w-3xl">
        <BigSpectrumCanvas
          audioRef={audioRef}
          isPlaying={isPlaying && !buffering}
          className="h-[120px] rounded-2xl overflow-hidden"
          bars={100}
        />
      </div>
      <div className="flex items-center gap-6">
        <button onClick={prev} className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition active:scale-90">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <button onClick={togglePlay} disabled={buffering} className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 hover:bg-primary/90 transition active:scale-90">
          {buffering ? (
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-9 h-9 fill-white text-white" />
          ) : (
            <Play className="w-9 h-9 fill-white text-white translate-x-1" />
          )}
        </button>
        <button onClick={next} className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition active:scale-90">
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
      <div className="flex items-center gap-3 w-full max-w-xs">
        <button onClick={toggleMute} className="text-white/40 hover:text-white transition">
          {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="flex-1 accent-primary cursor-pointer" />
      </div>
    </div>
  )
}

// ─── Category tile ────────────────────────────────────────────────────────────

function CategoryTile({
  playlist,
  index,
  isActive,
  isPlaying,
  onClick,
}: {
  playlist: MusicPlaylist
  index: number
  isActive: boolean
  isPlaying: boolean
  onClick: () => void
}) {
  const palette = CATEGORY_PALETTES[index % CATEGORY_PALETTES.length]
  const count = playlist.music_playlist_items?.length ?? 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]',
        isActive ? 'ring-2 ring-white/40 ring-offset-2 ring-offset-transparent' : ''
      )}
      style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
    >
      {/* Decorative circles */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-1 w-16 h-16 rounded-full bg-white/5" />

      {/* Active equalizer indicator */}
      {isActive && (
        <div className="absolute top-3 right-3">
          <Equalizer animate={isPlaying} />
        </div>
      )}

      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
          <Music2 className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-sm font-bold text-white leading-tight">{playlist.name}</h3>
        <p className="text-[11px] text-white/60 mt-1">{count} canción{count !== 1 ? 'es' : ''}</p>
      </div>
    </button>
  )
}

// ─── Track row ────────────────────────────────────────────────────────────────

function TrackRow({
  item,
  playlist,
  index,
  isCurrentTrack,
  isPlaying,
  onPlay,
}: {
  item: MusicPlaylist['music_playlist_items'][0]
  playlist: MusicPlaylist
  index: number
  isCurrentTrack: boolean
  isPlaying: boolean
  onPlay: () => void
}) {
  const track = item.music_tracks
  const coverUrl = getCoverUrl(track.cover_path)
  const grad = trackGradient(track.id)

  return (
    <button
      onClick={onPlay}
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 text-left w-full transition-colors duration-100',
        isCurrentTrack ? 'bg-primary/10' : 'hover:bg-white/5'
      )}
    >
      <div className="w-5 shrink-0 flex items-center justify-center">
        {isCurrentTrack ? (
          <Equalizer animate={isPlaying} />
        ) : (
          <>
            <span className="text-[12px] tabular-nums text-white/30 group-hover:hidden">{index + 1}</span>
            <Play className="w-3.5 h-3.5 fill-current text-white/70 hidden group-hover:block shrink-0" />
          </>
        )}
      </div>
      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
        {coverUrl ? (
          <img src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
            <span className="text-white/70 font-bold text-[13px] leading-none">{track.title[0]?.toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold truncate leading-tight', isCurrentTrack ? 'text-primary' : 'text-white')}>
          {track.title}
        </p>
        <p className="text-[11px] text-white/40 truncate mt-0.5">
          {track.artist ?? track.genre ?? '—'}
        </p>
      </div>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MusicPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)

  const profile = useAuthStore((s) => s.profile)
  const isSuperadmin = !!profile?.is_superadmin

  const access           = useMusicPlayer((s) => s.access)
  const playlists        = useMusicPlayer((s) => s.playlists)
  const catalogLoading   = useMusicPlayer((s) => s.catalogLoading)
  const loadCatalog      = useMusicPlayer((s) => s.loadCatalog)
  const catalogLoaded    = useMusicPlayer((s) => s.catalogLoaded)
  const activePlaylistId = useMusicPlayer((s) => s.activePlaylistId)
  const currentTrack     = useMusicPlayer((s) => s.currentTrack)
  const isPlaying        = useMusicPlayer((s) => s.isPlaying)
  const loadPlaylist     = useMusicPlayer((s) => s.loadPlaylist)

  useEffect(() => {
    if (!catalogLoaded) loadCatalog()
  }, [catalogLoaded, loadCatalog])

  // When catalog loads, auto-select the first playlist if none selected
  useEffect(() => {
    if (playlists.length > 0 && selectedPlaylistId === null) {
      setSelectedPlaylistId(playlists[0].id)
    }
  }, [playlists, selectedPlaylistId])

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const enterFullscreen = () => {
    containerRef.current?.requestFullscreen?.().catch(() => {})
    setFullscreen(true)
  }
  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setFullscreen(false)
  }

  if (catalogLoading || !catalogLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Cargando catálogo...</p>
        </div>
      </div>
    )
  }

  if (!access.enabled) return <MusicPaywall />

  const totalTracks = playlists.reduce((s, pl) => s + (pl.music_playlist_items?.length ?? 0), 0)
  const selectedPlaylist = playlists.find(pl => pl.id === selectedPlaylistId) ?? playlists[0] ?? null
  const selectedItems = selectedPlaylist
    ? [...(selectedPlaylist.music_playlist_items ?? [])].sort((a, b) => a.position - b.position)
    : []

  function handleUploaded() {
    setShowUpload(false)
    setTimeout(() => loadCatalog(), 500)
  }

  function handlePlayAll(playlist: MusicPlaylist) {
    const first = [...(playlist.music_playlist_items ?? [])].sort((a, b) => a.position - b.position)[0]
    if (first) loadPlaylist(playlist.id, first.music_tracks.id)
  }

  function handleShufflePlay(playlist: MusicPlaylist) {
    const items = [...(playlist.music_playlist_items ?? [])]
    if (items.length === 0) return
    const rand = items[Math.floor(Math.random() * items.length)]
    loadPlaylist(playlist.id, rand.music_tracks.id)
  }

  return (
    <div ref={containerRef} className="relative space-y-5">
      {fullscreen && <ModoMostrador onExit={exitFullscreen} />}
      {showUpload && <MusicUploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />}

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <Music2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-white leading-tight">Música</h1>
          <p className="text-[11px] text-white/35">
            {playlists.length} categoría{playlists.length !== 1 ? 's' : ''} · {totalTracks} canciones
            {access.plan_tier === 'premium' && <span className="ml-2 text-primary/70">✨ Premium</span>}
          </p>
        </div>
        {isSuperadmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => loadCatalog()} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 border border-white/10 transition" title="Recargar catálogo">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition">
              <Upload className="w-3.5 h-3.5" />
              Subir canción
            </button>
          </div>
        )}
      </div>

      {/* ── Main layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* Left: sticky player */}
        <div className="glass-panel rounded-2xl p-5 lg:sticky lg:top-4">
          <NowPlayingPanel onFullscreen={enterFullscreen} />
        </div>

        {/* Right: categories + tracks */}
        <div className="space-y-4">

          {/* Category tiles */}
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-white/40" />
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Categorías</span>
            </div>
            {playlists.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-white/30">
                <Music className="w-8 h-8" />
                <p className="text-sm">No hay categorías disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {playlists.map((pl, i) => (
                  <CategoryTile
                    key={pl.id}
                    playlist={pl}
                    index={i}
                    isActive={pl.id === activePlaylistId}
                    isPlaying={pl.id === activePlaylistId && isPlaying}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Track list for selected category */}
          {selectedPlaylist && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              {/* Track list header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <ListMusic className="w-4 h-4 text-white/40" />
                <span className="text-[13px] font-semibold text-white/80">{selectedPlaylist.name}</span>
                <span className="text-[11px] text-white/25 ml-1">{selectedItems.length}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => handlePlayAll(selectedPlaylist)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-primary text-white hover:bg-primary/90 transition active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    Reproducir
                  </button>
                  <button
                    onClick={() => handleShufflePlay(selectedPlaylist)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/8 border border-white/10 text-white/70 hover:bg-white/15 transition active:scale-95"
                  >
                    <Shuffle className="w-3 h-3" />
                    Aleatorio
                  </button>
                </div>
              </div>

              {selectedItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-white/30">
                  <Music className="w-8 h-8" />
                  <p className="text-sm">No hay canciones en esta categoría</p>
                </div>
              ) : (
                <div className="flex flex-col py-2">
                  {selectedItems.map((item, idx) => (
                    <TrackRow
                      key={item.id}
                      item={item}
                      playlist={selectedPlaylist}
                      index={idx}
                      isCurrentTrack={currentTrack?.id === item.music_tracks.id && activePlaylistId === selectedPlaylist.id}
                      isPlaying={currentTrack?.id === item.music_tracks.id && activePlaylistId === selectedPlaylist.id && isPlaying}
                      onPlay={() => loadPlaylist(selectedPlaylist.id, item.music_tracks.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

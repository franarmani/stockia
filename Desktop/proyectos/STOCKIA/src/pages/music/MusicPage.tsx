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
  Minimize2, ChevronLeft, ChevronRight, Music, Upload, RefreshCw,
} from 'lucide-react'
import { getCoverUrl, type MusicPlaylist } from '@/lib/music/api'
import { cn } from '@/lib/utils'

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
      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition"
        title="Salir del modo mostrador"
      >
        <Minimize2 className="w-5 h-5" />
      </button>

      {/* Clock */}
      <p className="text-5xl font-thin text-white/20 tabular-nums tracking-[0.15em]">{timeStr}</p>

      {/* Track info */}
      {track && (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">{track.title}</h2>
          {track.artist && <p className="text-lg text-white/40 mt-1">{track.artist}</p>}
        </div>
      )}

      {/* Big spectrum */}
      <div className="w-full max-w-3xl">
        <BigSpectrumCanvas
          audioRef={audioRef}
          isPlaying={isPlaying && !buffering}
          className="h-[120px] rounded-2xl overflow-hidden"
          bars={100}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={prev}
          className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition text-xl active:scale-90"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        <button
          onClick={togglePlay}
          disabled={buffering}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 hover:bg-primary/90 transition active:scale-90"
        >
          {buffering ? (
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-9 h-9 fill-white text-white" />
          ) : (
            <Play className="w-9 h-9 fill-white text-white translate-x-1" />
          )}
        </button>

        <button
          onClick={next}
          className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition text-xl active:scale-90"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <button onClick={toggleMute} className="text-white/40 hover:text-white transition">
          {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <input
          type="range" min={0} max={1} step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 accent-primary cursor-pointer"
        />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MusicPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const profile = useAuthStore((s) => s.profile)
  const isSuperadmin = !!profile?.is_superadmin

  const access          = useMusicPlayer((s) => s.access)
  const playlists       = useMusicPlayer((s) => s.playlists)
  const catalogLoading  = useMusicPlayer((s) => s.catalogLoading)
  const loadCatalog     = useMusicPlayer((s) => s.loadCatalog)
  const catalogLoaded   = useMusicPlayer((s) => s.catalogLoaded)
  const activePlaylistId = useMusicPlayer((s) => s.activePlaylistId)
  const loadPlaylist    = useMusicPlayer((s) => s.loadPlaylist)

  // Load if not yet loaded
  useEffect(() => {
    if (!catalogLoaded) loadCatalog()
  }, [catalogLoaded, loadCatalog])

  // Sync fullscreen state with browser fullscreen API
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
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

  const handlePlayTrack = (playlistId: string, trackIndex: number) => {
    loadPlaylist(playlistId, trackIndex)
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

  const allItems = playlists.flatMap((pl) =>
    [...(pl.music_playlist_items ?? [])].sort((a, b) => a.position - b.position).map((item) => ({ pl, item }))
  )

  function handleUploaded() {
    setShowUpload(false)
    // Force reload catalog to pick up the new Supabase track
    setTimeout(() => loadCatalog(), 500)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Fullscreen overlay */}
      {fullscreen && <ModoMostrador onExit={exitFullscreen} />}

      {/* Upload modal */}
      {showUpload && (
        <MusicUploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Music2 className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-[20px] font-bold text-white leading-tight">Música</h1>
          <p className="text-[11px] text-white/35">
            {access.plan_tier === 'premium' ? '✨ Premium' : access.plan_tier.toUpperCase()} — sin publicidad
          </p>
        </div>
        {/* Reload + Upload buttons (superadmin only) */}
        {isSuperadmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadCatalog()}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 border border-white/10 transition"
              title="Recargar catálogo"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Subir canción
            </button>
          </div>
        )}
      </div>

      {/* Layout: player arriba / lista abajo en mobile; lado a lado en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

        {/* Player */}
        <div className="glass-panel rounded-2xl p-5">
          <NowPlayingPanel onFullscreen={enterFullscreen} />
        </div>

        {/* Lista de canciones */}
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-[13px] font-semibold text-white/60 uppercase tracking-widest mb-3">
            Lista de canciones
          </h2>

          {catalogLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-white/30">
              <Music className="w-8 h-8" />
              <p className="text-sm">No hay canciones disponibles</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {allItems.map(({ pl, item }, idx) => {
                const track = item.music_tracks
                const coverUrl = getCoverUrl(track.cover_path)
                const isCurrentPlaylist = activePlaylistId === pl.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handlePlayTrack(pl.id, idx)}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full transition-all duration-150',
                      isCurrentPlaylist
                        ? 'bg-primary/12 ring-1 ring-primary/25'
                        : 'hover:bg-white/7 active:scale-[0.98]'
                    )}
                  >
                    {/* Número / play hover */}
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                      <span className={cn(
                        'text-[12px] tabular-nums font-medium transition group-hover:hidden',
                        isCurrentPlaylist ? 'text-primary' : 'text-white/30'
                      )}>
                        {idx + 1}
                      </span>
                      <Play className="w-4 h-4 fill-current text-white/70 hidden group-hover:block" />
                    </div>

                    {/* Cover */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/8 shrink-0 flex items-center justify-center">
                      {coverUrl
                        ? <img src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
                        : <Music className="w-4 h-4 text-white/20" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[13px] font-semibold truncate leading-tight',
                        isCurrentPlaylist ? 'text-primary' : 'text-white'
                      )}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">
                        {track.artist ?? track.genre ?? '—'}
                      </p>
                    </div>

                    {/* Equalizer animado si está sonando */}
                    {isCurrentPlaylist && (
                      <div className="flex items-end gap-0.5 h-4 shrink-0">
                        {[3, 5, 4].map((h, i) => (
                          <div
                            key={i}
                            className="w-0.5 rounded-full bg-primary animate-bounce"
                            style={{ height: `${h * 3}px`, animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

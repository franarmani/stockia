import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, Disc3, Headphones, ListMusic, Loader2, Music, Pause, Play, Radio, Sparkles, Volume2 } from 'lucide-react'
import PremiumMusicLock from '@/components/music/PremiumMusicLock'
import { usePlan } from '@/hooks/usePlan'
import { useBusinessStore } from '@/stores/businessStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { musicService } from '@/services/music.service'
import { MusicPlaylist, MusicTrack } from '@/types/music'
import { useMusicStore } from '@/stores/useMusicStore'
import { toast } from 'sonner'

export const FIXED_PLAYLISTS = (businessId?: string): MusicPlaylist[] => [
  {
    id: 'fixed-techno',
    business_id: businessId || '',
    name: 'Techno Playlist (Best of Techno)',
    description: 'BPM constante para la mejor atmósfera Techno.',
    mood: 'Techno',
    category: 'Electronic',
    cover_url: null,
    created_at: new Date().toISOString(),
    is_public: true
  },
  {
    id: 'fixed-rock',
    business_id: businessId || '',
    name: 'Rock Nacional: 100% Clásicos',
    description: 'Los mejores clásicos del rock argentino.',
    mood: 'Rock',
    category: 'Rock',
    cover_url: null,
    created_at: new Date().toISOString(),
    is_public: true
  }
]

export const INITIAL_TRACKS = (playlistId: string, businessId?: string): MusicTrack[] => {
  if (playlistId === 'fixed-techno') {
    return [
      { id: 't1', title: 'Instinct (Original Mix)', artist: 'Christian Craken', duration: 420, file_url: '/music/techno/01_Instinct.webm', order_index: 0 },
      { id: 't2', title: 'Chakra (Original Mix)', artist: 'Belocca', duration: 415, file_url: '/music/techno/02_Chakra.webm', order_index: 1 },
      { id: 't3', title: 'Dreams Are Destroyed', artist: 'Maksim Dark', duration: 390, file_url: '/music/techno/03_DreamsAreDestroyed.webm', order_index: 2 },
      { id: 't4', title: 'Voyager (Original Mix)', artist: 'Filterheadz', duration: 405, file_url: '/music/techno/04_Voyager.webm', order_index: 3 },
      { id: 't5', title: 'Space Raiders', artist: 'Eats Everything', duration: 380, file_url: '/music/techno/05_SpaceRaiders.webm', order_index: 4 },
      { id: 't6', title: 'Hold On (Original Mix)', artist: 'Spartaque', duration: 430, file_url: '/music/techno/06_HoldOn.webm', order_index: 5 },
      { id: 't7', title: 'Drama (Original Mix)', artist: 'Christian Craken', duration: 440, file_url: '/music/techno/07_Drama.webm', order_index: 6 },
      { id: 't8', title: 'Magnet (Original Mix)', artist: 'Christian Craken', duration: 420, file_url: '/music/techno/08_Magnet.webm', order_index: 7 },
      { id: 't9', title: 'Confuse (Original Mix)', artist: 'Maksim Dark & BOHO', duration: 400, file_url: '/music/techno/09_Confuse.webm', order_index: 8 },
      { id: 't10', title: 'Control System', artist: 'Belocca', duration: 425, file_url: '/music/techno/10_ControlSystem.webm', order_index: 9 },
      { id: 't11', title: 'Poison', artist: 'Skream', duration: 360, file_url: '/music/techno/11_Poison.webm', order_index: 10 },
      { id: 't12', title: 'Revolte (Remix)', artist: 'Paul Kalkbrenner', duration: 450, file_url: '/music/techno/12_Revolte.webm', order_index: 11 },
      { id: 't13', title: 'Osiris (Original Mix)', artist: 'Belocca', duration: 420, file_url: '/music/techno/13_Osiris.webm', order_index: 12 },
      { id: 't14', title: 'Orion (Original Mix)', artist: 'Belocca', duration: 415, file_url: '/music/techno/14_Orion.webm', order_index: 13 },
      { id: 't15', title: 'Space Tango', artist: 'Belocca', duration: 430, file_url: '/music/techno/15_SpaceTango.webm', order_index: 14 }
    ].map(t => ({ ...t, playlist_id: playlistId, business_id: businessId || '', file_path: null, youtube_id: null, created_at: new Date().toISOString() })) as MusicTrack[]
  }
  
  if (playlistId === 'fixed-rock') {
    return [
      { id: 'r1', title: 'Flaca', artist: 'Andrés Calamaro', duration: 287, file_url: '/music/rock/01_Flaca.webm', order_index: 0 },
      { id: 'r2', title: 'Por Mil Noches', artist: 'AIRBAG', duration: 305, file_url: '/music/rock/02_PorMilNoches.webm', order_index: 1 },
      { id: 'r3', title: 'Tu Carcel', artist: 'Enanitos Verdes', duration: 220, file_url: '/music/rock/03_TuCarcel.webm', order_index: 2 },
      { id: 'r4', title: 'Loco (Tu Forma De Ser)', artist: 'Los Auténticos Decadentes', duration: 290, file_url: '/music/rock/04_Loco.webm', order_index: 3 },
      { id: 'r5', title: 'A las Nueve', artist: 'No Te Va Gustar', duration: 215, file_url: '/music/rock/05_ALasNueve.webm', order_index: 4 },
      { id: 'r6', title: 'Crimen', artist: 'Gustavo Cerati', duration: 230, file_url: '/music/rock/06_Crimen.webm', order_index: 5 },
      { id: 'r7', title: 'Siguiendo La Luna', artist: 'Los Fabulosos Cadillacs', duration: 280, file_url: '/music/rock/07_SiguiendoLaLuna.webm', order_index: 6 },
      { id: 'r8', title: 'Creo', artist: 'Callejeros', duration: 310, file_url: '/music/rock/08_Creo.webm', order_index: 7 },
      { id: 'r9', title: 'Arrancacorazones', artist: 'Attaque 77', duration: 245, file_url: '/music/rock/09_Arrancacorazones.webm', order_index: 8 },
      { id: 'r10', title: 'La parte de adelante', artist: 'Andrés Calamaro', duration: 270, file_url: '/music/rock/10_LaParteDeAdelante.webm', order_index: 9 },
      { id: 'r11', title: '11 y 6', artist: 'Fito Paez', duration: 235, file_url: '/music/rock/11_11y6.webm', order_index: 10 },
      { id: 'r12', title: 'Nunca quise', artist: 'Intoxicados', duration: 250, file_url: '/music/rock/12_NuncaQuise.webm', order_index: 11 },
      { id: 'r13', title: 'No me importa el dinero', artist: 'Los Auténticos Decadentes', duration: 225, file_url: '/music/rock/13_NoMeImportaElDinero.webm', order_index: 12 },
      { id: 'r14', title: 'Como Olvidarme', artist: 'La Beriso', duration: 260, file_url: '/music/rock/14_ComoOlvidarme.webm', order_index: 13 },
      { id: 'r15', title: 'Ese Maldito Momento', artist: 'No Te Va Gustar', duration: 190, file_url: '/music/rock/15_EseMalditoMomento.webm', order_index: 14 }
    ].map(t => ({ ...t, playlist_id: playlistId, business_id: businessId || '', file_path: null, youtube_id: null, created_at: new Date().toISOString() })) as MusicTrack[]
  }

  return []
}

export default function MusicPage() {
  const { profile } = useAuthStore()
  const { initAudio, setPlaylist, currentPlaylist, currentTrack, isPlaying, togglePlay, playTrack } = useMusicStore()
  const [planState, setPlanState] = useState<'loading' | 'premium' | 'free'>('loading')
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [viewingPlaylist, setViewingPlaylist] = useState<MusicPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  // CajaGo Music es parte del plan Premium (y de la prueba gratis).
  const { isPremium } = usePlan()
  const business = useBusinessStore(state => state.business)
  useEffect(() => {
    if (!business) return
    setPlanState(isPremium ? 'premium' : 'free')
  }, [business, isPremium])

  useEffect(() => {
    if (planState !== 'premium') return
    initAudio()
    loadData()
  }, [planState])

  if (planState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm font-medium">Verificando plan...</p>
        </div>
      </div>
    )
  }

  if (planState === 'free') return <PremiumMusicLock />

  async function loadData() {
    const fixed = FIXED_PLAYLISTS(profile?.business_id)
    setPlaylists(fixed)

    if (!profile?.business_id) return
    try {
      setDataLoading(true)
      const playlistsData = await musicService.getPlaylists(profile.business_id)
      setPlaylists([...fixed, ...playlistsData])
    } catch (error: any) {
      toast.error('Error cargando música: ' + error.message)
    } finally {
      setDataLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00'
    const min = Math.floor(seconds / 60)
    const sec = Math.floor(seconds % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  async function getPlaylistTracks(playlist: MusicPlaylist) {
    if (playlist.id.startsWith('fixed-')) {
      return INITIAL_TRACKS(playlist.id, profile?.business_id)
    }
    return musicService.getTracksByPlaylist(playlist.id)
  }

  async function handleOpenPlaylist(playlist: MusicPlaylist) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setViewingPlaylist(playlist)
    setTracksLoading(true)
    try {
      const tracks = await getPlaylistTracks(playlist)
      setPlaylistTracks(tracks)
    } catch (error: any) {
      toast.error('Error al cargar tracks: ' + error.message)
    } finally {
      setTracksLoading(false)
    }
  }

  async function handlePlayPlaylist(playlist: MusicPlaylist) {
    try {
      const tracks = viewingPlaylist?.id === playlist.id && playlistTracks.length > 0
        ? playlistTracks
        : await getPlaylistTracks(playlist)
      if (tracks.length === 0) {
        toast.error('Esta playlist no tiene canciones')
        return
      }
      setPlaylist(playlist, tracks)
    } catch (error: any) {
      toast.error('No se pudo iniciar la reproducción: ' + error.message)
    }
  }

  const featuredPlaylist = playlists[0]
  const isViewingPlaylistActive = currentPlaylist?.id === viewingPlaylist?.id
  const artworkTone = (playlist: MusicPlaylist) => playlist.id === 'fixed-rock'
    ? 'bg-[#35213f] text-[#d9a7ff]'
    : 'bg-[#172a46] text-[#8bb8ff]'

  return (
    <div className="mx-auto max-w-[1180px] animate-fade-in space-y-8 pb-28">
      {viewingPlaylist ? (
        <section className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0c1322]">
          <div className="relative px-5 pb-7 pt-5 sm:px-8 sm:pb-9">
            <div className="absolute right-[-6rem] top-[-8rem] h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
            <button
              onClick={() => setViewingPlaylist(null)}
              className="relative z-10 mb-7 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la biblioteca
            </button>

            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className={`relative aspect-square w-44 shrink-0 overflow-hidden rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:w-52 ${artworkTone(viewingPlaylist)}`}>
                <Disc3 className="absolute -bottom-7 -right-7 h-40 w-40 opacity-20" strokeWidth={1.2} />
                <div className="absolute inset-x-5 bottom-5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-60">CajaGo Music</span>
                  <p className="mt-1 text-2xl font-black leading-none tracking-[-0.04em]">{viewingPlaylist.mood || 'Mix'}</p>
                </div>
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-xs font-bold text-primary">Playlist oficial</p>
                <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                  {viewingPlaylist.name}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">
                  {viewingPlaylist.description || 'Una selección preparada para acompañar el ritmo de tu negocio.'}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                  <span className="font-bold text-white">CajaGo</span>
                  <span>•</span>
                  <span>{playlistTracks.length} canciones</span>
                  <span>•</span>
                  <span>Actualización automática</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-[#090f1b]/80 px-3 py-5 sm:px-6">
            <div className="mb-5 flex items-center gap-3 px-2">
              <button
                onClick={() => isViewingPlaylistActive && currentTrack ? togglePlay() : handlePlayPlaylist(viewingPlaylist)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_35px_rgba(99,102,241,0.3)] transition hover:scale-105 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-[#090f1b]"
                aria-label={isViewingPlaylistActive && isPlaying ? 'Pausar playlist' : 'Reproducir playlist'}
              >
                {isViewingPlaylistActive && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <div>
                <p className="text-sm font-semibold text-white">{isViewingPlaylistActive ? 'Reproducción activa' : 'Reproducir playlist'}</p>
                <p className="text-xs text-white/35">Sonido continuo para tu local</p>
              </div>
            </div>

            <div className="hidden grid-cols-[42px_minmax(0,1fr)_110px] gap-3 border-b border-white/[0.07] px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 sm:grid">
              <span>#</span><span>Título</span><span className="text-right"><Clock3 className="ml-auto h-3.5 w-3.5" /></span>
            </div>

            {tracksLoading ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-white/35">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs font-medium">Preparando la playlist</p>
              </div>
            ) : playlistTracks.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <ListMusic className="h-9 w-9 text-white/15" />
                <p className="text-sm font-medium text-white/40">Esta playlist todavía no tiene canciones.</p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                {playlistTracks.map((track, index) => {
                  const active = currentTrack?.id === track.id
                  return (
                    <button
                      key={track.id}
                      onClick={() => {
                        setPlaylist(viewingPlaylist, playlistTracks, false)
                        playTrack(track)
                      }}
                      className={`group grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40 sm:grid-cols-[42px_minmax(0,1fr)_110px] ${active ? 'bg-primary/10' : 'hover:bg-white/[0.045]'}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center text-xs font-medium ${active ? 'text-primary' : 'text-white/35'}`}>
                        {active && isPlaying ? (
                          <span className="flex h-4 items-end gap-[2px]" aria-label="Reproduciendo">
                            <i className="h-2 w-[2px] animate-pulse bg-primary" /><i className="h-4 w-[2px] animate-pulse bg-primary [animation-delay:120ms]" /><i className="h-3 w-[2px] animate-pulse bg-primary [animation-delay:240ms]" />
                          </span>
                        ) : (
                          <><span className="group-hover:hidden">{index + 1}</span><Play className="hidden h-4 w-4 fill-current group-hover:block" /></>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-sm font-semibold ${active ? 'text-primary' : 'text-white'}`}>{track.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-white/35">{track.artist || 'Artista desconocido'}</span>
                      </span>
                      <span className="tabular-nums text-xs text-white/30">{formatTime(track.duration ?? 0)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#0c1322] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
            <div className="absolute right-[-5rem] top-[-8rem] h-80 w-80 rounded-full bg-primary/15 blur-[100px]" />
            <div className="absolute bottom-[-8rem] left-[30%] h-56 w-56 rounded-full bg-blue-500/10 blur-[90px]" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_30px_rgba(99,102,241,0.28)]">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary">CajaGo Music</p>
                    <p className="text-[11px] text-white/35">Incluido en tu plan Pro</p>
                  </div>
                </div>
                <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-5xl">
                  La música de tu negocio, sin interrupciones.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/50">
                  Elegí una selección y dejá que CajaGo mantenga el ambiente mientras trabajás en ventas, caja o stock.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => featuredPlaylist && handlePlayPlaylist(featuredPlaylist)}
                    disabled={!featuredPlaylist}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-[#0c1322]"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Reproducir selección
                  </button>
                  <div className="flex items-center gap-2 text-xs text-white/35"><Radio className="h-4 w-4 text-primary" /> Audio continuo en toda la app</div>
                </div>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[280px] lg:mx-0 lg:ml-auto">
                <div className="absolute inset-0 rounded-full border border-white/10 bg-[#080d17] shadow-[0_30px_80px_rgba(0,0,0,0.45)]" />
                <div className={`absolute inset-[14%] overflow-hidden rounded-[26px] ${featuredPlaylist ? artworkTone(featuredPlaylist) : 'bg-[#172a46] text-[#8bb8ff]'}`}>
                  <Disc3 className="absolute -bottom-8 -right-8 h-44 w-44 opacity-25" strokeWidth={1.1} />
                  <div className="absolute inset-x-5 bottom-5">
                    <Sparkles className="mb-3 h-5 w-5" />
                    <p className="text-2xl font-black leading-none tracking-[-0.04em]">{featuredPlaylist?.mood || 'CajaGo Mix'}</p>
                  </div>
                </div>
                <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#0c1322] bg-primary" />
              </div>
            </div>
          </section>

          {currentTrack && (
            <section className="grid gap-4 rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><Volume2 className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Sonando ahora</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{currentTrack.title} <span className="font-normal text-white/35">— {currentTrack.artist}</span></p>
              </div>
              <button onClick={togglePlay} className="flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-[#0b1120] transition hover:scale-[1.02] active:scale-[0.98]">
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                {isPlaying ? 'Pausar' : 'Continuar'}
              </button>
            </section>
          )}

          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary">Tu biblioteca</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Playlists para cada momento</h2>
              </div>
              <p className="hidden text-xs text-white/30 sm:block">{playlists.length} selecciones disponibles</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {dataLoading ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-[0.82] animate-pulse rounded-2xl bg-white/[0.035]" />
              )) : playlists.map(playlist => (
                <article
                  key={playlist.id}
                  onClick={() => handleOpenPlaylist(playlist)}
                  className="group cursor-pointer rounded-2xl bg-white/[0.035] p-3 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] focus-within:ring-2 focus-within:ring-primary/40 sm:p-4"
                >
                  <div className={`relative aspect-square overflow-hidden rounded-xl ${artworkTone(playlist)}`}>
                    <Disc3 className="absolute -bottom-5 -right-5 h-28 w-28 opacity-25 sm:h-36 sm:w-36" strokeWidth={1.1} />
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">CajaGo Music</p>
                      <p className="mt-1 text-xl font-black leading-none tracking-[-0.04em] sm:text-2xl">{playlist.mood || 'Mix'}</p>
                    </div>
                    <button
                      onClick={(event) => { event.stopPropagation(); void handlePlayPlaylist(playlist) }}
                      className="absolute bottom-3 right-3 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
                      aria-label={`Reproducir ${playlist.name}`}
                    >
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </button>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-sm font-bold leading-5 text-white">{playlist.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/35">{playlist.description || 'Selección musical para tu comercio.'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-white/[0.06] bg-[#0c1322] p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary"><Music className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold text-white">Pensado para jornadas largas</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-white/40">La reproducción continúa aunque cambies de módulo. Usá el reproductor flotante para pausar, avanzar o cerrar la música.</p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

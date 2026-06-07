import { useEffect, useState } from 'react'
import { Music, Plus, Play, Clock, LayoutGrid, ListMusic, CalendarClock, Star, Sparkles, Upload, Zap as ZapIcon, PlayCircle, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import PremiumMusicLock from '@/components/music/PremiumMusicLock'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { musicService } from '@/services/music.service'
import { MusicPlaylist, MusicTrack } from '@/types/music'
import { useMusicStore } from '@/stores/useMusicStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import PlaylistFormModal from '@/components/music/PlaylistFormModal'
import UploadTrackModal from '@/components/music/UploadTrackModal'

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
  const { initAudio, setPlaylist, currentTrack, isPlaying, togglePlay, playTrack } = useMusicStore()
  const [planState, setPlanState] = useState<'loading' | 'premium' | 'free'>('loading')
  
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  
  // Modal states
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [editingPlaylist, setEditingPlaylist] = useState<MusicPlaylist | null>(null)
  
  // Navigation states
  const [viewingPlaylist, setViewingPlaylist] = useState<MusicPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  useEffect(() => {
    if (!profile?.business_id) return
    supabase
      .from('businesses')
      .select('plan')
      .eq('id', profile.business_id)
      .single()
      .then(({ data }) => {
        const vip = data?.plan === 'vip' || data?.plan === 'premium'
        setPlanState(vip ? 'premium' : 'free')
      })
      .catch(() => setPlanState('free'))
  }, [profile?.business_id])

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

  async function handleDeletePlaylist(id: string) {
    if (id.startsWith('fixed-')) {
       toast.error('No se pueden eliminar las playlists del sistema')
       return
    }
    if (!confirm('¿Estás seguro de eliminar esta playlist?')) return
    try {
      await musicService.deletePlaylist(id)
      toast.success('Playlist eliminada')
      loadData()
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message)
    }
  }

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

  async function handleOpenPlaylist(playlist: MusicPlaylist) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setViewingPlaylist(playlist)
    setTracksLoading(true)
    try {
      let tracks: MusicTrack[] = []
      if (playlist.id.startsWith('fixed-')) {
        tracks = INITIAL_TRACKS(playlist.id, profile?.business_id)
      } else {
        tracks = await musicService.getTracksByPlaylist(playlist.id)
      }
      setPlaylistTracks(tracks)
    } catch (error: any) {
      toast.error('Error al cargar tracks: ' + error.message)
    } finally {
      setTracksLoading(false)
    }
  }

  async function handleDeleteTrack(trackId: string) {
    if (!confirm('¿Eliminar esta canción?')) return
    try {
      await musicService.deleteTrack(trackId)
      toast.success('Track eliminado')
      if (viewingPlaylist) handleOpenPlaylist(viewingPlaylist)
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  return (
    <div className="animate-fade-in space-y-6 pb-24 max-w-5xl mx-auto">
      {/* ── Header Section ── */}
      <div className="relative p-6 rounded-[2rem] bg-surface border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[60px] -mr-24 -mt-24" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
              <Music className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-black text-white tracking-tight">Stockia Music</h1>
                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[8px] font-black text-primary uppercase tracking-widest leading-none">PRO</span>
              </div>
              <p className="text-white/30 text-xs font-medium uppercase tracking-wider">Sonido Inteligente</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-col gap-6">
        
        {/* Playlists / Tracks Column */}
        <div className="space-y-4">
          
          {viewingPlaylist ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               {/* Tracks Header */}
               <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setViewingPlaylist(null)}
                    className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Volver a Playlists
                  </button>
               </div>

               <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
                  <div className="p-8 bg-primary/5 border-b border-white/5">
                     <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 inline-block">{viewingPlaylist.mood || 'Mix'}</span>
                     <h2 className="text-3xl font-black text-white tracking-tight">{viewingPlaylist.name}</h2>
                     <p className="text-sm text-white/40 mt-1 font-medium">{viewingPlaylist.description || 'Playlist personalizada'}</p>
                  </div>

                  <div className="p-4 space-y-1">
                     {tracksLoading ? (
                       <div className="py-20 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Sincronizando biblioteca...</p>
                       </div>
                     ) : playlistTracks.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                           <ListMusic className="w-8 h-8 text-white/5" />
                           <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Esta playlist está vacía</p>
                        </div>
                     ) : (
                       playlistTracks.map((track, i) => {
                         const isActive = currentTrack?.id === track.id
                         return (
                           <div 
                             key={track.id}
                             className={cn(
                               "group flex items-center gap-4 p-3 rounded-2xl transition-all border",
                               isActive 
                                 ? "bg-primary/10 border-primary/20" 
                                 : "hover:bg-white/[0.03] border-transparent hover:border-white/5"
                             )}
                           >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black transition-all",
                                isActive ? "bg-primary text-white" : "bg-white/5 text-white/20 group-hover:bg-primary/10 group-hover:text-primary"
                              )}>
                                 {isActive ? <PlayCircle className="w-5 h-5 fill-current" /> : i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <h4 className={cn("text-sm font-bold truncate", isActive ? "text-primary" : "text-white")}>{track.title}</h4>
                                 <p className="text-xs text-white/30 truncate">{track.artist || 'Artista Desconocido'}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-white/10 group-hover:text-white/30 transition-colors uppercase tracking-widest min-w-[32px] text-right">
                                   {formatTime(track.duration)}
                                </span>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                   <button 
                                     onClick={() => {
                                       // First set the context without auto-playing the first track
                                       // @ts-ignore - added third param in store
                                       setPlaylist(viewingPlaylist, playlistTracks, false)
                                       // Then play the specific track
                                       playTrack(track)
                                     }}
                                     className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white active:scale-90"
                                   >
                                     <Play className="w-4 h-4 fill-current" />
                                   </button>
                                </div>
                              </div>
                           </div>
                         )
                       })
                     )}
                  </div>
               </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Biblioteca Fija</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-[1.5rem] bg-white/[0.03] border border-white/5 animate-pulse" />
                  ))
                ) : (
                  playlists.map((playlist) => {
                    const isFixed = playlist.id.startsWith('fixed-')
                    // Show only fixed playlists for now as per "Pro" request
                    if (!isFixed) return null
                    
                    return (
                      <div 
                        key={playlist.id}
                        onClick={() => handleOpenPlaylist(playlist)}
                        className="group cursor-pointer glass-card border-white/5 hover:border-primary/20 transition-all p-6 flex flex-col justify-between h-52 rounded-[2rem] relative overflow-hidden"
                      >
                        {/* Decorative Background Icon */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 text-white/[0.02] group-hover:text-primary/10 transition-colors rotate-12">
                           <Music className="w-full h-full" />
                        </div>

                        <div className="relative z-10 flex justify-between items-start">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">{playlist.mood || 'Mix'}</span>
                             <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tight leading-tight">
                              {playlist.name}
                             </h3>
                             <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mt-1">Playlist oficial</p>
                          </div>
                        </div>

                        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-3">
                              <div className="flex -space-x-1.5">
                                 {[1, 0.6, 0.3].map((op, i) => (
                                   <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" style={{ opacity: op }} />
                                 ))}
                              </div>
                              <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Sincronizado</span>
                           </div>
                           
                           <button 
                             onClick={async (e) => {
                               e.stopPropagation()
                               await handleOpenPlaylist(playlist)
                               try {
                                 let tracks: MusicTrack[] = []
                                 if (playlist.id.startsWith('fixed-')) {
                                   tracks = INITIAL_TRACKS(playlist.id, profile?.business_id)
                                 } else {
                                   tracks = await musicService.getTracksByPlaylist(playlist.id)
                                 }
                                 
                                 if (tracks.length === 0) {
                                   toast.error('Esta playlist no tiene tracks')
                                   return
                                 }
                                 setPlaylist(playlist, tracks)
                                 toast.success(`Reproduciendo: ${playlist.name}`)
                               } catch (error: any) {
                                 toast.error('Error: ' + error.message)
                               }
                             }}
                             className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                           >
                             <Play className="w-5 h-5 fill-current" />
                           </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="mt-8 p-5 rounded-[1.5rem] bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                       <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-[11px] font-black text-primary uppercase tracking-widest">En este momento</p>
                 </div>
                 <p className="text-xs text-white/40 leading-relaxed font-medium">
                    Tu establecimiento está en horario pico. Se recomienda el estilo <span className="text-white">{viewingPlaylist?.mood || 'Techno'}</span> para aumentar la rotación.
                 </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

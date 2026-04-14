import { useEffect, useState } from 'react'
import { Music, Plus, Play, Clock, LayoutGrid, ListMusic, CalendarClock, Star, Sparkles, Upload, Zap as ZapIcon, PlayCircle, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { usePremiumAccess } from '@/hooks/usePremiumAccess'
import PremiumMusicLock from '@/components/music/PremiumMusicLock'
import { useAuthStore } from '@/stores/authStore'
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
      { id: 't1', business_id: businessId || '', title: 'Instinct (Original Mix)', artist: 'Christian Craken', youtube_id: 'TSUHK9c_Vf4', duration: 420 },
      { id: 't2', business_id: businessId || '', title: 'Chakra (Original Mix)', artist: 'Belocca', youtube_id: 'RJqiszBFHsI', duration: 415 },
      { id: 't3', business_id: businessId || '', title: 'Dreams Are Destroyed', artist: 'Maksim Dark', youtube_id: 'XOnqnN3DtGg', duration: 390 },
      { id: 't4', business_id: businessId || '', title: 'Voyager (Original Mix)', artist: 'Filterheadz', youtube_id: 'D1TpfsemFEI', duration: 405 },
      { id: 't5', business_id: businessId || '', title: 'Space Raiders', artist: 'Eats Everything', youtube_id: 'HYDEs3sEurg', duration: 380 },
      { id: 't6', business_id: businessId || '', title: 'Hold On (Original Mix)', artist: 'Spartaque', youtube_id: '7nLpW-9Y0vI', duration: 430 },
      { id: 't7', business_id: businessId || '', title: 'Drama (Original Mix)', artist: 'Christian Craken', youtube_id: 'Z8N8p9X_Mvg', duration: 440 },
      { id: 't8', business_id: businessId || '', title: 'Rubber (Original Mix)', artist: 'Maksim Dark', youtube_id: 'gL-C0-a4Vq4', duration: 410 },
      { id: 't9', business_id: businessId || '', title: 'Push It (Original Mix)', artist: 'Christian Craken', youtube_id: '_H9H_6C_yqI', duration: 400 },
      { id: 't10', business_id: businessId || '', title: 'Control System', artist: 'Belocca', youtube_id: 'dExJ9MYvdsk', duration: 425 },
      { id: 't11', business_id: businessId || '', title: 'Poison', artist: 'Skream', youtube_id: 'okxDNU6rEcs', duration: 360 },
      { id: 't12', business_id: businessId || '', title: 'Revolte (Remix)', artist: 'Paul Kalkbrenner', youtube_id: 'wShU40oJRLA', duration: 450 },
      { id: 't13', business_id: businessId || '', title: 'Osiris (Original Mix)', artist: 'Belocca', youtube_id: 'EFMSo2TUtWA', duration: 420 },
      { id: 't14', business_id: businessId || '', title: 'Orion (Original Mix)', artist: 'Belocca', youtube_id: '9r1cSB1NnZA', duration: 415 },
      { id: 't15', business_id: businessId || '', title: 'Space Tango', artist: 'Belocca', youtube_id: '8OK321fNOPg', duration: 430 }
    ].map(t => ({ ...t, created_at: new Date().toISOString() })) as MusicTrack[]
  }
  
  if (playlistId === 'fixed-rock') {
    return [
      { id: 'r1', business_id: businessId || '', title: 'Flaca', artist: 'Andrés Calamaro', youtube_id: 'UCF9oHXhDMU', duration: 287 },
      { id: 'r2', business_id: businessId || '', title: 'Por Mil Noches', artist: 'AIRBAG', youtube_id: 'kdfkr1WEzIc', duration: 305 },
      { id: 'r3', business_id: businessId || '', title: 'Tu Carcel', artist: 'Enanitos Verdes', youtube_id: 'BQAKKp6ziD0', duration: 220 },
      { id: 'r4', business_id: businessId || '', title: 'Loco (Tu Forma De Ser)', artist: 'Los Auténticos Decadentes', youtube_id: 'pHPTDX_vS-4', duration: 290 },
      { id: 'r5', business_id: businessId || '', title: 'A las Nueve', artist: 'No Te Va Gustar', youtube_id: '9fgvFwQUr3o', duration: 215 },
      { id: 'r6', business_id: businessId || '', title: 'Crimen', artist: 'Gustavo Cerati', youtube_id: 'uLIs0j2WnlM', duration: 230 },
      { id: 'r7', business_id: businessId || '', title: 'Siguiendo La Luna', artist: 'Los Fabulosos Cadillacs', youtube_id: '8UfGvL-yH2o', duration: 280 },
      { id: 'r8', business_id: businessId || '', title: 'Creo', artist: 'Callejeros', youtube_id: 'ezlpwCLgiE8', duration: 310 },
      { id: 'r9', business_id: businessId || '', title: 'Arrancacorazones', artist: 'Attaque 77', youtube_id: '1zNfElP3Br8', duration: 245 },
      { id: 'r10', business_id: businessId || '', title: 'La parte de adelante', artist: 'Andrés Calamaro', youtube_id: 'f0SG-aGlOxE', duration: 270 },
      { id: 'r11', business_id: businessId || '', title: '11 y 6', artist: 'Fito Paez', youtube_id: 'j6pCHLfo0KI', duration: 235 },
      { id: 'r12', business_id: businessId || '', title: 'Nunca quise', artist: 'Intoxicados', youtube_id: 'bdqvUwn1tbE', duration: 250 },
      { id: 'r13', business_id: businessId || '', title: 'No me importa el dinero', artist: 'Los Auténticos Decadentes', youtube_id: 'LXFL5mdfP40', duration: 225 },
      { id: 'r14', business_id: businessId || '', title: 'Como Olvidarme', artist: 'La Beriso', youtube_id: 'uo8qDCDZhK0', duration: 260 },
      { id: 'r15', business_id: businessId || '', title: 'Ese Maldito Momento', artist: 'No Te Va Gustar', youtube_id: 'NvB0sFK1sjY', duration: 190 }
    ].map(t => ({ ...t, created_at: new Date().toISOString() })) as MusicTrack[]
  }

  return []
}

export default function MusicPage() {
  const { isPremium } = usePremiumAccess()
  const { profile } = useAuthStore()
  const { initAudio, setPlaylist, currentTrack, isPlaying, togglePlay, playTrack } = useMusicStore()
  
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  
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
    if (!isPremium) return
    initAudio()
    loadData()
  }, [isPremium])

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
      setLoading(true)
      const playlistsData = await musicService.getPlaylists(profile.business_id)
      setPlaylists([...fixed, ...playlistsData])
    } catch (error: any) {
      toast.error('Error cargando música: ' + error.message)
    } finally {
      setLoading(false)
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

  if (!isPremium) return <PremiumMusicLock />

  return (
    <div className="animate-fade-in space-y-6 pb-24 max-w-5xl mx-auto">
      {/* ── Header Section ── */}
      <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-white/[0.04] to-transparent border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-[60px] -mr-24 -mt-24" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Music className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-black text-white tracking-tight">Stockia Music</h1>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">PRO</span>
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
                  <div className="p-8 bg-gradient-to-br from-amber-500/10 to-transparent border-b border-white/5">
                     <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-2 inline-block">{viewingPlaylist.mood || 'Mix'}</span>
                     <h2 className="text-3xl font-black text-white tracking-tight">{viewingPlaylist.name}</h2>
                     <p className="text-sm text-white/40 mt-1 font-medium">{viewingPlaylist.description || 'Playlist personalizada'}</p>
                  </div>

                  <div className="p-4 space-y-1">
                     {tracksLoading ? (
                       <div className="py-20 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
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
                                 ? "bg-amber-500/10 border-amber-500/20" 
                                 : "hover:bg-white/[0.03] border-transparent hover:border-white/5"
                             )}
                           >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black transition-all",
                                isActive ? "bg-amber-500 text-slate-950" : "bg-white/5 text-white/20 group-hover:bg-amber-500/10 group-hover:text-amber-500"
                              )}>
                                 {isActive ? <PlayCircle className="w-5 h-5 fill-current" /> : i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <h4 className={cn("text-sm font-bold truncate", isActive ? "text-amber-500" : "text-white")}>{track.title}</h4>
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
                                     className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/10 active:scale-90"
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
                {loading ? (
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
                        className="group cursor-pointer glass-card border-white/5 hover:border-amber-500/20 transition-all p-6 flex flex-col justify-between h-52 rounded-[2rem] relative overflow-hidden"
                      >
                        {/* Decorative Background Icon */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 text-white/[0.02] group-hover:text-amber-500/[0.04] transition-colors rotate-12">
                           <Music className="w-full h-full" />
                        </div>

                        <div className="relative z-10 flex justify-between items-start">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-2">{playlist.mood || 'Mix'}</span>
                             <h3 className="text-xl font-black text-white group-hover:text-amber-500 transition-colors tracking-tight leading-tight">
                              {playlist.name}
                             </h3>
                             <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mt-1">Playlist oficial</p>
                          </div>
                        </div>

                        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-3">
                              <div className="flex -space-x-1.5">
                                 {[1, 0.6, 0.3].map((op, i) => (
                                   <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500" style={{ opacity: op }} />
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
                             className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 transition-all shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95"
                           >
                             <Play className="w-5 h-5 fill-current" />
                           </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="mt-8 p-5 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                       <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">En este momento</p>
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

import { useEffect, useState } from 'react'
import { Music, Plus, Play, Clock, LayoutGrid, ListMusic, CalendarClock, Star, Sparkles, Upload } from 'lucide-react'
import { usePremiumAccess } from '@/hooks/usePremiumAccess'
import PremiumMusicLock from '@/components/music/PremiumMusicLock'
import { useAuthStore } from '@/stores/authStore'
import { musicService } from '@/services/music.service'
import { MusicPlaylist } from '@/types/music'
import { useMusicStore } from '@/stores/useMusicStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import PlaylistFormModal from '@/components/music/PlaylistFormModal'
import UploadTrackModal from '@/components/music/UploadTrackModal'
import ScheduleManager from '@/components/music/ScheduleManager'
import { MusicSchedule } from '@/types/music'

export default function MusicPage() {
  const { isPremium } = usePremiumAccess()
  const { profile } = useAuthStore()
  const { initAudio, setPlaylist, currentTrack, isPlaying, togglePlay } = useMusicStore()
  
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [schedules, setSchedules] = useState<(MusicSchedule & { music_playlists: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'playlists' | 'schedule' | 'upload'>('playlists')
  
  // Modal states
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [editingPlaylist, setEditingPlaylist] = useState<MusicPlaylist | null>(null)

  useEffect(() => {
    if (!isPremium) return
    initAudio()
    loadData()
  }, [isPremium])

  async function loadData() {
    if (!profile?.business_id) return
    try {
      setLoading(true)
      const [playlistsData, schedulesData] = await Promise.all([
        musicService.getPlaylists(profile.business_id),
        musicService.getSchedules(profile.business_id)
      ])
      setPlaylists(playlistsData)
      setSchedules(schedulesData)
    } catch (error: any) {
      toast.error('Error cargando música: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isPremium) return <PremiumMusicLock />

  return (
    <div className="animate-fade-in space-y-8 pb-24">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Music className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Stockia Music</h1>
            <p className="text-sm text-white/40 font-medium">Gestioná la atmósfera sonora de tu negocio</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold text-sm">
             <CalendarClock className="w-4 h-4" />
             <span className="hidden sm:inline">Programar</span>
           </button>
           <button 
             onClick={() => setShowPlaylistModal(true)}
             className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-slate-950 hover:brightness-110 transition-all font-black text-sm shadow-lg shadow-primary/20"
           >
             <Plus className="w-4 h-4" />
             Nueva Playlist
           </button>
        </div>
      </div>

      {/* ── Suggested Playlists (Visual Mock) ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">Sugeridas por rubro</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'Tech / Moderno', icon: LayoutGrid, color: 'bg-blue-500' },
            { name: 'Chill / Café',   icon: Clock,      color: 'bg-amber-500' },
            { name: 'Moda / Retail', icon: Star,       color: 'bg-pink-500' },
            { name: 'Energía / Pico', icon: Zap,        color: 'bg-red-500' },
            { name: 'Showroom',       icon: Sparkles,   color: 'bg-purple-500' },
            { name: 'Clásico',        icon: ListMusic,  color: 'bg-slate-500' }
          ].map((item, i) => (
            <button 
              key={i}
              className="group relative h-40 rounded-3xl overflow-hidden border border-white/5 hover:border-white/20 transition-all"
            >
              <div className={cn("absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity", item.color)} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                <item.icon className="w-8 h-8 text-white/40 group-hover:text-white transition-colors" />
                <span className="text-[11px] font-black text-white/60 group-hover:text-white uppercase tracking-wider text-center">
                  {item.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('playlists')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'playlists' ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"
          )}
        >
          Mis Playlists
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'schedule' ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"
          )}
        >
          Programación
        </button>
        <button 
          onClick={() => {
            if (playlists.length === 0) {
              toast.error('Crea una playlist primero')
            } else {
              setSelectedPlaylistId(playlists[0].id)
              setShowUploadModal(true)
            }
          }}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all gap-2 flex items-center",
            activeTab === 'upload' ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          Subir Tracks
        </button>
      </div>

      {/* ── Tabs Content ── */}
      {activeTab === 'schedule' ? (
        <ScheduleManager 
          businessId={profile?.business_id || ''}
          playlists={playlists}
          schedules={schedules}
          onRefresh={loadData}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
            ))
          ) : playlists.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-center">
               <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                 <ListMusic className="w-10 h-10 text-white/10" />
               </div>
               <div>
                 <p className="text-white font-bold">No tenés ninguna playlist todavía</p>
                 <p className="text-white/30 text-sm">Empezá creando una para ambientar tu negocio.</p>
               </div>
               <button 
                 onClick={() => setShowPlaylistModal(true)}
                 className="mt-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all active:scale-95"
               >
                 Crear mi primera playlist
               </button>
            </div>
          ) : (
            playlists.map((playlist) => (
              <div 
                key={playlist.id}
                className="glass-card group hover:border-white/20 transition-all p-5 flex flex-col justify-between h-64 border-white/10"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                     <Music className="w-5 h-5 text-white/30" />
                  </div>
                  {playlist.is_favorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                </div>

                <div>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                    {playlist.mood || 'Mix'}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors truncate flex-1">
                      {playlist.name}
                    </h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPlaylistId(playlist.id)
                        setShowUploadModal(true)
                      }}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
                      title="Subir tracks"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-white/40 line-clamp-2 mt-1">
                    {playlist.description || 'Sin descripción'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-auto border-t border-white/5">
                  <div className="flex items-center gap-2 text-[11px] text-white/30 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Tracks</span>
                  </div>
                  
                  <button 
                    onClick={async () => {
                      try {
                        const tracks = await musicService.getTracksByPlaylist(playlist.id)
                        if (tracks.length === 0) {
                          toast.error('Esta playlist no tiene tracks')
                          return
                        }
                        setPlaylist(playlist, tracks)
                        toast.success(`Reproduciendo: ${playlist.name}`)
                      } catch (error: any) {
                        toast.error('Error al cargar tracks: ' + error.message)
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-slate-950 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-lg shadow-primary/30 active:scale-90"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showPlaylistModal && (
        <PlaylistFormModal 
          onClose={() => {
            setShowPlaylistModal(false)
            setEditingPlaylist(null)
          }}
          onSuccess={loadData}
          initialData={editingPlaylist}
        />
      )}

      {showUploadModal && selectedPlaylistId && (
        <UploadTrackModal 
          onClose={() => {
            setShowUploadModal(false)
            setSelectedPlaylistId(null)
          }}
          onSuccess={() => {
            toast.success('Track subido correctamente')
            loadData()
          }}
          playlistId={selectedPlaylistId}
        />
      )}
    </div>
  )
}

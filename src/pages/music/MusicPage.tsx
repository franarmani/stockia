import { useEffect, useState } from 'react'
import { Music, Plus, Play, Clock, LayoutGrid, ListMusic, CalendarClock, Star, Sparkles, Upload, Zap, PlayCircle } from 'lucide-react'
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
    <div className="animate-fade-in space-y-10 pb-24">
      {/* ── Header Section ── */}
      <div className="relative p-8 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Music className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-white tracking-tight">Stockia Music</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest">Premium</span>
              </div>
              <p className="text-white/40 font-medium">Gestioná el sonido y la atmósfera de todos tus locales</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setActiveTab('schedule')}
               className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all font-bold text-sm"
             >
               <CalendarClock className="w-4 h-4" />
               Programación
             </button>
             <button 
               onClick={() => setShowPlaylistModal(true)}
               className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95"
             >
               <Plus className="w-5 h-5" />
               Nueva Playlist
             </button>
          </div>
        </div>
      </div>

      {/* ── Suggested Playlists (Visual Selection) ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-[11px] font-black text-white/30 uppercase tracking-[0.25em]">Estilos sugeridos</h2>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'Tech / Moderno', icon: LayoutGrid, color: 'from-blue-500/20' },
            { name: 'Chill / Café',   icon: Clock,      color: 'from-amber-500/20' },
            { name: 'Moda / Retail', icon: Star,       color: 'from-pink-500/20' },
            { name: 'Energía / Pico', icon: Zap,        color: 'from-red-500/20' },
            { name: 'Showroom',       icon: Sparkles,   color: 'from-purple-500/20' },
            { name: 'Clásico',        icon: ListMusic,  color: 'from-slate-500/20' }
          ].map((item, i) => (
            <button 
              key={i}
              className="group relative h-44 rounded-[2rem] overflow-hidden border border-white/5 hover:border-amber-500/30 transition-all duration-500"
            >
              <div className={cn("absolute inset-0 bg-gradient-to-b to-transparent opacity-40 group-hover:opacity-60 transition-opacity", item.color)} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-5">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/10 transition-all duration-500">
                  <item.icon className="w-6 h-6 text-white/20 group-hover:text-amber-500 transition-colors" />
                </div>
                <span className="text-[10px] font-black text-white/40 group-hover:text-white uppercase tracking-[0.15em] text-center leading-tight">
                  {item.name}
                </span>
              </div>
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                <PlayCircle className="w-5 h-5 text-amber-500" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Main Dashboard ── */}
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-1">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setActiveTab('playlists')}
              className={cn(
                "relative py-4 text-xs font-black uppercase tracking-[0.2em] transition-all",
                activeTab === 'playlists' ? "text-white" : "text-white/20 hover:text-white/40"
              )}
            >
              Mis Playlists
              {activeTab === 'playlists' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
            </button>
            <button 
              onClick={() => setActiveTab('schedule')}
              className={cn(
                "relative py-4 text-xs font-black uppercase tracking-[0.2em] transition-all",
                activeTab === 'schedule' ? "text-white" : "text-white/20 hover:text-white/40"
              )}
            >
              Programación
              {activeTab === 'schedule' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
            </button>
          </div>

          <button 
            onClick={() => {
              if (playlists.length === 0) {
                toast.error('Crea una playlist primero')
              } else {
                setSelectedPlaylistId(playlists[0].id)
                setShowUploadModal(true)
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider"
          >
            <Upload className="w-3.5 h-3.5" />
            Subir Tracks
          </button>
        </div>

        {/* Tab Content Rendering */}
        <div className="pt-4">
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
                  <div key={i} className="h-64 rounded-[2.5rem] bg-white/[0.03] border border-white/5 animate-pulse" />
                ))
              ) : playlists.length === 0 ? (
                <div className="col-span-full py-24 flex flex-col items-center justify-center gap-6 text-center">
                   <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] flex items-center justify-center border border-white/5 relative">
                     <ListMusic className="w-10 h-10 text-white/10" />
                     <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-[1.25rem] bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                       <Plus className="w-5 h-5 text-amber-500" />
                     </div>
                   </div>
                   <div className="space-y-2">
                     <h3 className="text-xl font-bold text-white">Sonido en silencio</h3>
                     <p className="text-white/30 text-sm max-w-xs mx-auto">Empezá creando una playlist personalizada para ambientar tu local.</p>
                   </div>
                   <button 
                     onClick={() => setShowPlaylistModal(true)}
                     className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all active:scale-95 flex items-center gap-3"
                   >
                     <Plus className="w-4 h-4" />
                     Crear mi primera playlist
                   </button>
                </div>
              ) : (
                playlists.map((playlist) => (
                  <div 
                    key={playlist.id}
                    className="glass-card group hover:border-amber-500/30 transition-all duration-500 p-6 flex flex-col justify-between h-[320px] rounded-[2.5rem] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.02] blur-3xl -mr-16 -mt-16" />
                    
                    <div className="flex justify-between items-start relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center group-hover:bg-amber-500/10 transition-all duration-500">
                         <Music className="w-6 h-6 text-white/20 group-hover:text-amber-500" />
                      </div>
                      {playlist.is_favorite && (
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 animate-pulse">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      )}
                    </div>

                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.25em] mb-2">
                        {playlist.mood || 'Standard Mix'}
                      </p>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="text-2xl font-black text-white group-hover:text-amber-500 transition-colors truncate">
                          {playlist.name}
                        </h3>
                      </div>
                      <p className="text-sm text-white/35 line-clamp-2 leading-relaxed h-10">
                        {playlist.description || 'Ambientación musical personalizada para tu negocio.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Estado</span>
                           <span className="text-xs font-bold text-white/40">Listo</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPlaylistId(playlist.id)
                            setShowUploadModal(true)
                          }}
                          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                          title="Gestionar tracks"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
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
                        className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 transition-all duration-500 shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-1 active:scale-90"
                      >
                        <Play className="w-6 h-6 fill-current" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals (Keep Existing Logic) ── */}
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

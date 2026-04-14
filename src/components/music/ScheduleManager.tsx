import { useState } from 'react'
import { Calendar, Clock, Trash2, Plus, PlayCircle, X } from 'lucide-react'
import { musicService } from '@/services/music.service'
import { MusicSchedule, MusicPlaylist } from '@/types/music'
import { toast } from 'sonner'
import { GlassButton } from '@/components/ui/GlassCard'

interface ScheduleManagerProps {
  businessId: string
  playlists: MusicPlaylist[]
  schedules: (MusicSchedule & { music_playlists: { name: string } })[]
  onRefresh: () => void
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function ScheduleManager({ businessId, playlists, schedules, onRefresh }: ScheduleManagerProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [newSchedule, setNewSchedule] = useState({
    playlist_id: playlists[0]?.id || '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00'
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await musicService.createSchedule({
        ...newSchedule,
        business_id: businessId,
        is_active: true
      })
      toast.success('Programación agregada')
      setShowAdd(false)
      onRefresh()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await musicService.deleteSchedule(id)
      toast.success('Programación eliminada')
      onRefresh()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Programación Automática</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-sm font-bold"
        >
          <Plus className="w-4 h-4" />
          Agregar Horario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
             <Calendar className="w-10 h-10 text-white/10 mx-auto mb-3" />
             <p className="text-white/40 font-medium">No hay programaciones activas</p>
          </div>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="glass-card p-4 border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  {DAYS[s.day_of_week]}
                </span>
                <button 
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 text-white/20 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-white truncate">{s.music_playlists?.name}</span>
              </div>

              <div className="flex items-center gap-2 text-white/40 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border-white/10 shadow-2xl animate-scale-in p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nuevo Horario</h3>
              <button onClick={() => setShowAdd(false)} className="text-white/40"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-1">Playlist</label>
                <select 
                  value={newSchedule.playlist_id}
                  onChange={e => setNewSchedule({ ...newSchedule, playlist_id: e.target.value })}
                  className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                >
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-1">Día</label>
                <select 
                  value={newSchedule.day_of_week}
                  onChange={e => setNewSchedule({ ...newSchedule, day_of_week: parseInt(e.target.value) })}
                  className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-1">Inicio</label>
                  <input 
                    type="time" 
                    value={newSchedule.start_time}
                    onChange={e => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-1">Fin</label>
                  <input 
                    type="time" 
                    value={newSchedule.end_time}
                    onChange={e => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                 <GlassButton type="button" onClick={() => setShowAdd(false)} className="flex-1">Cancelar</GlassButton>
                 <button 
                   type="submit" 
                   disabled={loading}
                   className="flex-[2] h-12 rounded-2xl bg-primary text-slate-950 font-black text-sm shadow-xl shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                 >
                   {loading ? 'Guardando...' : 'Programar'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Music, X, Save, Image as ImageIcon } from 'lucide-react'
import { musicService } from '@/services/music.service'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { GlassButton } from '@/components/ui/GlassCard'

interface PlaylistFormModalProps {
  onClose: () => void
  onSuccess: () => void
  initialData?: any
}

export default function PlaylistFormModal({ onClose, onSuccess, initialData }: PlaylistFormModalProps) {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    mood: initialData?.mood || 'chill',
    category: initialData?.category || 'Tech',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.business_id) return
    
    setLoading(true)
    try {
      if (initialData?.id) {
        await musicService.updatePlaylist(initialData.id, formData)
        toast.success('Playlist actualizada')
      } else {
        await musicService.createPlaylist({
          ...formData,
          business_id: profile.business_id
        })
        toast.success('Playlist creada')
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-lg border-white/10 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20">
               <Music className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {initialData ? 'Editar Playlist' : 'Nueva Playlist'}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Nombre de la Playlist</label>
            <input
              required
              autoFocus
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Chill para la mañana"
              className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describí el mood de esta playlist..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Mood / Ánimo</label>
              <select
                value={formData.mood}
                onChange={e => setFormData({ ...formData, mood: e.target.value })}
                className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white focus:outline-none text-sm"
              >
                <option value="chill">Relax / Chill</option>
                <option value="energetic">Energético / Upbeat</option>
                <option value="elegant">Elegante / Premium</option>
                <option value="focus">Concentración</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Categoría / Rubro</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-11 bg-slate-900 border border-white/10 rounded-xl px-4 text-white focus:outline-none text-sm"
              >
                <option value="Tech">Tech</option>
                <option value="Café">Café / Bar</option>
                <option value="Moda">Moda / Tienda</option>
                <option value="Showroom">Showroom</option>
                <option value="Gimnasio">Gimnasio</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
             <GlassButton
               type="button"
               onClick={onClose}
               className="flex-1 h-12 text-white/60 font-bold border-white/10"
             >
               Cancelar
             </GlassButton>
             <button
               type="submit"
               disabled={loading}
               className="flex-[2] h-12 rounded-2xl bg-primary text-slate-950 font-black text-sm shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               {loading ? 'Guardando...' : (
                 <>
                   <Save className="w-4 h-4" />
                   {initialData ? 'Guardar Cambios' : 'Crear Playlist'}
                 </>
               )}
             </button>
          </div>
        </form>
      </div>
    </div>
  )
}

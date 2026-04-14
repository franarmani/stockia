import { useState, useRef } from 'react'
import { Upload, X, Music, Check, Loader2, FileAudio } from 'lucide-react'
import { musicService } from '@/services/music.service'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { GlassButton } from '@/components/ui/GlassCard'

interface UploadTrackModalProps {
  onClose: () => void
  onSuccess: () => void
  playlistId: string
}

export default function UploadTrackModal({ onClose, onSuccess, playlistId }: UploadTrackModalProps) {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState({
    title: '',
    artist: ''
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.type.startsWith('audio/')) {
        toast.error('Por favor, seleccioná un archivo de audio (MP3, WAV, etc.)')
        return
      }
      setFile(selectedFile)
      // Auto-fill title from filename
      if (!metadata.title) {
        setMetadata({ ...metadata, title: selectedFile.name.replace(/\.[^/.]+$/, "") })
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.business_id || !file || !playlistId) return
    
    setLoading(true)
    try {
      await musicService.uploadTrack(
        profile.business_id,
        playlistId,
        file,
        metadata
      )
      toast.success('Track subido exitosamente')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error('Error al subir: ' + error.message)
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
               <Upload className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white">Subir Track</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* File Drop Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center gap-3
              ${file 
                ? 'border-primary/40 bg-primary/5' 
                : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'}
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="audio/*" 
              className="hidden" 
            />
            
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${file ? 'bg-primary text-slate-950' : 'bg-white/5 text-white/20 group-hover:text-white/40'}`}>
              {file ? <Check className="w-7 h-7" /> : <FileAudio className="w-7 h-7" />}
            </div>

            <div className="text-center">
              <p className="text-sm font-bold text-white mb-1">
                {file ? file.name : 'Seleccioná un archivo de audio'}
              </p>
              <p className="text-xs text-white/30">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Máximo 20MB por track'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Título del Track</label>
              <input
                required
                value={metadata.title}
                onChange={e => setMetadata({ ...metadata, title: e.target.value })}
                placeholder="Nombre de la canción"
                className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest pl-1">Artista (Opcional)</label>
              <input
                value={metadata.artist}
                onChange={e => setMetadata({ ...metadata, artist: e.target.value })}
                placeholder="Nombre del artista o banda"
                className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all font-medium text-sm"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
             <GlassButton
               type="button"
               onClick={onClose}
               className="flex-1 h-12 text-white/60 font-bold border-white/10"
             >
               Cancelar
             </GlassButton>
             <button
               type="submit"
               disabled={loading || !file}
               className="flex-[2] h-12 rounded-2xl bg-primary text-slate-950 font-black text-sm shadow-xl shadow-primary/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
             >
               {loading ? (
                 <>
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Subiendo...
                 </>
               ) : (
                 <>
                   <Upload className="w-4 h-4" />
                   Subir Track
                 </>
               )}
             </button>
          </div>
        </form>
      </div>
    </div>
  )
}

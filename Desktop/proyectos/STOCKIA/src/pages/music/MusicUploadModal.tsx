// src/pages/music/MusicUploadModal.tsx
// Modal para que superadmins suban canciones a Supabase Storage.
// Flujo: seleccionar archivo → metadatos → subir → confirmar → recargar catálogo.

import { useRef, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  initiateTrackUpload,
  uploadFileToSignedUrl,
  confirmTrackUpload,
} from '@/lib/music/api'
import { X, Upload, Music, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const GENRES = ['Afro House', 'Afro Latino', 'Chill', 'Cumbia', 'Deep House', 'Electronic', 'Folklore', 'House', 'Latin', 'Lofi', 'Pop', 'Reggaeton', 'Salsa', 'Tropical', 'Otro']

type Step = 'select' | 'meta' | 'uploading' | 'done'

interface Props {
  onClose: () => void
  onUploaded: () => void
}

export default function MusicUploadModal({ onClose, onUploaded }: Props) {
  const profile = useAuthStore((s) => s.profile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('select')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [genre, setGenre] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function pickFile(f: File) {
    if (!f.type.startsWith('audio/')) {
      toast.error('Solo se permiten archivos de audio (mp3, wav, etc.)')
      return
    }
    setFile(f)
    // Auto-fill title from filename without extension
    const base = f.name.replace(/\.[^.]+$/, '')
    setTitle(base)
    setStep('meta')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file || !title.trim() || !profile?.business_id) return
    setError(null)
    setStep('uploading')
    setProgress(0)

    try {
      // Step 1: initiate (get signed URL + create DB row)
      const { track_id, audio_upload_url } = await initiateTrackUpload({
        title: title.trim(),
        artist: artist.trim() || null,
        genre: genre || null,
        filename: file.name,
        mime: file.type || 'audio/mpeg',
        size_bytes: file.size,
      })

      // Step 2: upload file bytes to signed URL
      await uploadFileToSignedUrl(audio_upload_url, file, setProgress)

      // Step 3: activate track + add to playlist
      await confirmTrackUpload(track_id, profile.business_id)

      setStep('done')
      toast.success(`"${title.trim()}" subida correctamente`)
      onUploaded()
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
      setStep('meta')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Upload className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-[16px] font-bold text-white">Subir canción</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── STEP: select file ── */}
        {step === 'select' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 py-14 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              dragging
                ? 'border-primary/60 bg-primary/10'
                : 'border-white/15 hover:border-white/30 hover:bg-white/5'
            )}
          >
            <Music className="w-10 h-10 text-white/20" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white/70">Arrastrá un archivo de audio</p>
              <p className="text-[11px] text-white/35 mt-1">o hacé click para buscarlo</p>
              <p className="text-[10px] text-white/25 mt-2">MP3, WAV, AAC — máx. 50 MB</p>
            </div>
          </div>
        )}

        {/* ── STEP: metadata ── */}
        {step === 'meta' && file && (
          <div className="flex flex-col gap-4">
            {/* File preview */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
              <Music className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-white/40">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button onClick={() => setStep('select')} className="text-white/30 hover:text-white/70 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Título *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre de la canción"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition"
                autoFocus
              />
            </div>

            {/* Artist */}
            <div>
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Artista</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Nombre del artista (opcional)"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition"
              />
            </div>

            {/* Genre */}
            <div>
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block mb-1.5">Género</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition appearance-none"
              >
                <option value="" className="bg-[#0d1f3c]">Sin género</option>
                {GENRES.map((g) => (
                  <option key={g} value={g} className="bg-[#0d1f3c]">{g}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 border border-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!title.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Subir
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: uploading ── */}
        {step === 'uploading' && (
          <div className="flex flex-col items-center gap-5 py-8">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="w-full">
              <div className="flex justify-between text-[11px] text-white/40 mb-1.5">
                <span>Subiendo archivo…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-[12px] text-white/40 text-center">{title}</p>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <div className="text-center">
              <p className="text-[15px] font-bold text-white">¡Canción subida!</p>
              <p className="text-[12px] text-white/40 mt-1">Ya aparece en tu lista de canciones</p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
        />
      </div>
    </div>
  )
}

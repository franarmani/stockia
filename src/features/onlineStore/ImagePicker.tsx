import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Globe, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isOnline } from '@/sync/connectivity'
import { useAuthStore } from '@/stores/authStore'
import { uploadStoreImage } from './storeImages'
import ImageSearchModal from './ImageSearchModal'

/** Elegir, cambiar o quitar una foto. Sube al instante y devuelve la URL con onChange. */
export default function ImagePicker({
  value,
  onChange,
  kind = 'product',
  className,
  label = 'Foto',
  searchQuery,
}: {
  value: string | null
  onChange: (url: string | null) => void
  kind?: 'product' | 'cover'
  className?: string
  label?: string
  /** Nombre del producto: si viene, aparece "Buscar en internet". */
  searchQuery?: string
}) {
  const { profile } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [searching, setSearching] = useState(false)

  async function pick(file: File | undefined, rethrow = false) {
    if (!file || !profile?.business_id) return
    if (!isOnline()) { toast.error('Subir fotos necesita conexión a internet'); return }
    if (file.size > 15 * 1024 * 1024) { toast.error('La foto es muy pesada (máximo 15 MB)'); return }
    setUploading(true)
    try {
      onChange(await uploadStoreImage(profile.business_id, file, kind))
    } catch (error: any) {
      toast.error(`No se pudo subir la foto: ${error?.message ?? 'error desconocido'}`)
      if (rethrow) throw error
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]', kind === 'cover' ? 'aspect-[3/1]' : 'aspect-square', className)}>
      {value ? (
        <img src={value} alt="" className="h-full w-full object-cover" />
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-white/40 hover:text-white/70 transition-colors">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[12px] font-medium">{uploading ? 'Subiendo…' : `Agregar ${label.toLowerCase()}`}</span>
        </button>
      )}
      {!value && searchQuery !== undefined && !uploading && (
        <button type="button" onClick={() => setSearching(true)}
          className="absolute inset-x-1.5 bottom-1.5 flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary/90 text-[11px] font-semibold text-white hover:bg-primary">
          <Globe className="h-3.5 w-3.5" /> Buscar en internet
        </button>
      )}
      {value && (
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="h-7 rounded-md bg-white/90 px-2 text-[11px] font-semibold text-slate-900 hover:bg-white">
            {uploading ? 'Subiendo…' : 'Cambiar'}
          </button>
          {searchQuery !== undefined && (
            <button type="button" onClick={() => setSearching(true)} aria-label="Buscar en internet" title="Buscar en internet"
              className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-900 hover:bg-white">
              <Globe className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => onChange(null)} aria-label="Quitar foto"
            className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-900 hover:bg-white">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {searchQuery !== undefined && (
        <ImageSearchModal open={searching} initialQuery={searchQuery} onClose={() => setSearching(false)} onPick={(file) => pick(file, true)} />
      )}
    </div>
  )
}

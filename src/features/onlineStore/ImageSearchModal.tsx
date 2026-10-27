import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import type { ImageResult } from '../../../supabase/functions/_shared/imageSearch'

/** Busca fotos del producto en internet (fondo blanco) y devuelve la elegida como archivo. */
export default function ImageSearchModal({
  open,
  initialQuery,
  onClose,
  onPick,
}: {
  open: boolean
  initialQuery: string
  onClose: () => void
  onPick: (file: File) => Promise<void>
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  async function search(text = query) {
    if (text.trim().length < 2) return
    setLoading(true); setError(''); setSearched(true)
    const { data, error: invokeError } = await supabase.functions.invoke('product-images', { body: { action: 'search', query: text } })
    setLoading(false)
    if (invokeError) {
      const detail = await (invokeError as any)?.context?.json?.().catch(() => null)
      setError(detail?.error || 'No se pudo buscar. Probá de nuevo.')
      setResults([])
      return
    }
    setResults(data?.results ?? [])
  }

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery); setResults([]); setError(''); setSearched(false)
    if (initialQuery.trim().length >= 2) search(initialQuery)
  }, [open])

  async function choose(result: ImageResult) {
    setChoosing(result.url)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('product-images', { body: { action: 'fetch', url: result.url } })
      if (invokeError || !(data instanceof Blob)) {
        const detail = await (invokeError as any)?.context?.json?.().catch(() => null)
        throw new Error(detail?.error || 'No se pudo bajar esa imagen, probá con otra')
      }
      await onPick(new File([data], 'producto', { type: data.type || 'image/png' }))
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo usar esa imagen')
    } finally {
      setChoosing(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar foto en internet" size="lg">
      <div className="space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del producto"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-primary/40"
            />
          </div>
          <button disabled={loading} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">Buscar</button>
        </form>
        <p className="text-xs text-white/40">Se buscan fotos del producto con fondo blanco. Usá solo imágenes que puedas publicar en tu negocio.</p>

        {loading ? (
          <div className="grid h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div>
        ) : error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
        ) : searched && results.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/40">No encontramos fotos. Probá con otro nombre.</p>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {results.map((result) => (
              <button
                key={result.url}
                type="button"
                onClick={() => choose(result)}
                disabled={!!choosing}
                title={result.title}
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white hover:border-primary disabled:opacity-60"
              >
                <img src={result.thumbnail} alt={result.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
                {choosing === result.url && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Usar esta</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

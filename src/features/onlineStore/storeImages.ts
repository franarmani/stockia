import { supabase } from '@/lib/supabase'

// Fotos de la tienda online. Se achican en el equipo antes de subir (WebP, lado mayor acotado)
// para que con muchos negocios el almacenamiento no se dispare: una foto queda en ~50-150 KB.

const BUCKET = 'product-images'

async function decodeImage(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('El archivo no es una imagen válida'))
        el.src = url
      })
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        close: () => URL.revokeObjectURL(url),
      }
    } catch (err) {
      URL.revokeObjectURL(url)
      throw err
    }
  }
}

async function toWebp(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
    throw new Error('El archivo no es una imagen')
  }
  const decoded = await decodeImage(file)
  try {
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    decoded.draw(canvas.getContext('2d')!, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob) throw new Error('No se pudo procesar la imagen')
    return blob
  } finally {
    decoded.close()
  }
}

/** Sube la foto y devuelve su URL pública. kind 'cover' es la portada de la tienda (más ancha). */
export async function uploadStoreImage(businessId: string, file: File, kind: 'product' | 'cover' = 'product'): Promise<string> {
  const blob = await toWebp(file, kind === 'cover' ? 1600 : 900)
  const path = `${businessId}/${kind === 'cover' ? 'store' : 'products'}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Borra una foto anterior de este bucket (las URLs de otros lugares se ignoran). */
export async function removeStoreImage(url: string | null | undefined) {
  const marker = `/object/public/${BUCKET}/`
  if (!url || !url.includes(marker)) return
  await supabase.storage.from(BUCKET).remove([url.split(marker)[1]])
}

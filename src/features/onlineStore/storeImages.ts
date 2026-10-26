import { supabase } from '@/lib/supabase'

// Fotos de la tienda online. Se achican en el equipo antes de subir (WebP, lado mayor acotado)
// para que con muchos negocios el almacenamiento no se dispare: una foto queda en ~50-150 KB.

const BUCKET = 'product-images'

async function toWebp(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return blob
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

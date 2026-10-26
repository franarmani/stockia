import { supabase } from '@/lib/supabase'
import { isOnline } from '@/sync/connectivity'
import type { ProductField } from './columnMatcher'

/** Fila de encabezados y columnas que reconoció la IA, o null si no está disponible (se usa la detección por nombre). */
export async function detectColumnsWithAI(preview: string[][]): Promise<{ header_row: number; columns: Record<number, ProductField> } | null> {
  if (!isOnline() || preview.length === 0) return null
  try {
    const { data, error } = await supabase.functions.invoke('products-ai-map', { body: { preview } })
    if (error || !data?.columns) return null
    return data
  } catch {
    return null
  }
}

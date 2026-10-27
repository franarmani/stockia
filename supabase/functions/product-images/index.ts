// Fotos de producto desde internet: busca (Google Programmable Search) y descarga la elegida
// para que el programa la suba al negocio (el navegador no puede bajarla por CORS).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, INACTIVE_MESSAGE } from '../_shared/access.ts'
import type { ImageResult } from '../_shared/imageSearch.ts'
import { MAX_IMAGE_BYTES, buildImageQuery, isSafeImageUrl, parseBingImages, parseGoogleImages } from '../_shared/imageSearch.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'No autorizado' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await admin.from('users').select('business_id').eq('id', user.id).maybeSingle()
    if (!profile?.business_id) return json({ error: 'Usuario sin negocio' }, 403)
    if (!(await businessIsActive(admin, profile.business_id))) return json({ error: INACTIVE_MESSAGE }, 403)

    const body = await request.json().catch(() => ({}))

    if (body.action === 'search') {
      const name = String(body.query ?? '').trim()
      if (name.length < 2) return json({ error: 'Escribí el nombre del producto' }, 400)
      const key = Deno.env.get('GOOGLE_CSE_KEY')
      const cx = Deno.env.get('GOOGLE_CSE_CX')
      let results: ImageResult[] = []

      // Sin claves ni cuotas: se lee la búsqueda de imágenes de Bing. Si algún día se configuran
      // GOOGLE_CSE_KEY y GOOGLE_CSE_CX, se usa Google (más estable) y Bing queda de respaldo.
      if (key && cx) {
        try {
          const params = new URLSearchParams({
            key, cx, q: buildImageQuery(name), searchType: 'image', num: '10', safe: 'active', imgSize: 'medium',
            start: String(Math.min(91, Math.max(1, Number(body.start) || 1))), fileType: 'png', imgDominantColor: 'white',
          })
          const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, { signal: AbortSignal.timeout(15_000) })
          if (response.ok) results = parseGoogleImages(await response.json())
        } catch (error) { console.warn('[product-images] google', error) }
      }
      if (results.length < 4) {
        const first = Math.max(0, Number(body.start) || 0)
        for (const [filters, query] of [
          ['+filterui:photo-photo+filterui:imagesize-medium', buildImageQuery(name)],
          ['+filterui:photo-photo', `${name} fondo blanco`],
        ] as const) {
          try {
            const page = new URL('https://www.bing.com/images/search')
            page.search = new URLSearchParams({ q: query, qft: filters, first: String(first), form: 'HDRSC3', setlang: 'es-AR', cc: 'AR' }).toString()
            const response = await fetch(page, {
              signal: AbortSignal.timeout(15_000),
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' },
            })
            if (!response.ok) continue
            const seen = new Set(results.map(r => r.url))
            results = [...results, ...parseBingImages(await response.text()).filter(r => !seen.has(r.url))]
            if (results.length >= 12) break
          } catch (error) { console.warn('[product-images] bing', error) }
        }
      }
      if (results.length === 0) return json({ error: 'No se pudo buscar en internet en este momento. Probá de nuevo en un rato o subí la foto desde tu equipo.' }, 502)
      results = results.slice(0, 30)
      return json({ results })
    }

    if (body.action === 'fetch') {
      let target = String(body.url ?? '')
      for (let hop = 0; hop < 4; hop++) {
        if (!isSafeImageUrl(target)) return json({ error: 'Dirección de imagen no permitida' }, 400)
        const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Mozilla/5.0 CajaGo' } })
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const next = response.headers.get('location')
          if (!next) return json({ error: 'No se pudo bajar la imagen' }, 502)
          target = new URL(next, target).toString()
          continue
        }
        if (!response.ok) return json({ error: 'No se pudo bajar la imagen' }, 502)
        const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
        if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) return json({ error: 'El archivo no es una imagen compatible' }, 415)
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'La imagen es demasiado pesada' }, 413)
        return new Response(bytes, { headers: { ...corsHeaders, 'Content-Type': type } })
      }
      return json({ error: 'No se pudo bajar la imagen' }, 502)
    }

    return json({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[product-images]', error)
    return json({ error: 'No se pudo buscar imágenes, probá de nuevo' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Le pide a la IA (Groq, gratis) que encuentre encabezados y columnas en la planilla de productos que subió el comercio.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, INACTIVE_MESSAGE } from '../_shared/access.ts'
import { buildColumnsPrompt, parseColumnsAnswer } from '../_shared/aiColumns.ts'
import { GROQ_CHAT_COMPLETIONS_URL, GROQ_DEFAULT_MODEL } from '../_shared/groq.ts'

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
    const preview: string[][] = Array.isArray(body?.preview)
      ? body.preview.slice(0, 20).map((row: unknown) => Array.isArray(row) ? row.slice(0, 20).map(cell => String(cell ?? '').slice(0, 60)) : [])
      : []
    if (preview.length === 0) return json({ error: 'La planilla está vacía' }, 400)
    const width = Math.max(...preview.map(row => row.length))

    const key = Deno.env.get('GROQ_API_KEY') ?? Deno.env.get('VITE_GROQ_API_KEY')
    if (!key) return json({ error: 'La detección con IA no está configurada' }, 503)

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Sos un asistente que analiza planillas de productos y responde solo JSON válido.' },
          { role: 'user', content: buildColumnsPrompt(preview) },
        ],
      }),
    })
    if (!response.ok) {
      console.error('[products-ai-map] groq', response.status, await response.text())
      return json({ error: 'La IA no respondió, se usa la detección automática' }, 502)
    }
    const data = await response.json()
    const result = parseColumnsAnswer(data?.choices?.[0]?.message?.content, width, preview.length)
    if (!result) return json({ error: 'La IA no pudo reconocer las columnas' }, 422)
    return json(result)
  } catch (error) {
    console.error('[products-ai-map]', error)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

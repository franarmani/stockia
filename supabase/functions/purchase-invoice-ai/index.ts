// Lee una factura de compra (fotos o páginas de un PDF) con IA (Groq, gratis) y devuelve proveedor, comprobante y renglones.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { businessIsActive, INACTIVE_MESSAGE } from '../_shared/access.ts'
import { INVOICE_PROMPT, parseInvoiceAnswer } from '../_shared/purchaseInvoice.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_IMAGES = 3
const MAX_IMAGE_CHARS = 5_000_000

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
    const { data: premium } = await admin.rpc('business_has_premium', { p_business_id: profile.business_id })
    if (!premium) return json({ error: 'Cargar facturas con IA es del plan Premium' }, 403)

    const body = await request.json().catch(() => ({}))
    const images: string[] = (Array.isArray(body?.images) ? body.images : [])
      .filter((image: unknown) => typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(image) && image.length <= MAX_IMAGE_CHARS)
      .slice(0, MAX_IMAGES)
    if (images.length === 0) return json({ error: 'Mandá una foto o un PDF de la factura' }, 400)

    const key = Deno.env.get('GROQ_API_KEY') ?? Deno.env.get('VITE_GROQ_API_KEY')
    if (!key) return json({ error: 'La lectura con IA no está configurada' }, 503)

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_VISION_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: INVOICE_PROMPT },
            ...images.map(url => ({ type: 'image_url', image_url: { url } })),
          ],
        }],
      }),
    })
    if (!response.ok) {
      console.error('[purchase-invoice-ai] groq', response.status, await response.text())
      return json({ error: 'La IA no respondió. Probá de nuevo en un momento.' }, 502)
    }
    const data = await response.json()
    const invoice = parseInvoiceAnswer(data?.choices?.[0]?.message?.content)
    if (!invoice || invoice.items.length === 0) return json({ error: 'No se pudo leer la factura. Probá con una foto más nítida.' }, 422)
    return json(invoice)
  } catch (error) {
    console.error('[purchase-invoice-ai]', error)
    return json({ error: 'Error inesperado' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

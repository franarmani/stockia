import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ARCA_TIMEOUT_MS = 10_000

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'No autorizado' }, 401)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    let payload: { cuit?: unknown }
    try {
      const body = await request.json()
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Request JSON invalido' }, 400)
      payload = body as { cuit?: unknown }
    } catch {
      return json({ error: 'Request JSON invalido' }, 400)
    }

    const rawCuit = payload.cuit
    const cuit = String(rawCuit || '').replace(/\D/g, '')
    if (!/^\d{11}$/.test(cuit)) return json({ error: 'CUIT inválido' }, 400)

    const endpoint = Deno.env.get('ARCA_PADRON_ENDPOINT')
    const accessToken = Deno.env.get('ARCA_PADRON_ACCESS_TOKEN')
    if (!endpoint || !accessToken) {
      return json({ available: false, reason: 'ARCA no está configurado. Continúe con la carga manual.' }, 503)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ARCA_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${endpoint.replace(/\/$/, '')}/${cuit}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (response.status === 404) return json({ available: false, reason: 'ARCA no encontró el CUIT indicado.' }, 404)
    if (!response.ok) return json({ available: false, reason: 'El servicio de ARCA no está disponible temporalmente.' }, 502)
    const official = await response.json()
    return json({
      available: true,
      supplier: {
        cuit,
        legal_name: official.razonSocial ?? official.nombre ?? null,
        trade_name: official.nombreFantasia ?? null,
        vat_condition: official.condicionIva ?? null,
        address: official.domicilio?.direccion ?? official.domicilio ?? null,
        city: official.domicilio?.localidad ?? null,
        province: official.domicilio?.provincia ?? null,
        postal_code: official.domicilio?.codigoPostal ?? null,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return json({ available: false, reason: 'La consulta a ARCA superó el tiempo de espera.' }, 504)
    return json({ available: false, reason: 'No se pudo consultar ARCA. Continúe con la carga manual.' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// supabase/functions/business-intelligence/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
       return new Response(JSON.stringify({ ok: false, error: 'Sin autorización.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { action, params } = body

    if (action === 'analyze-product') {
      return await handleAnalyzeProduct(params, corsHeaders)
    } else {
      throw new Error(`Acción no reconocida: ${action}`)
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: `Error crítico: ${err.message}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleAnalyzeProduct(params: any, headers: any) {
  const { productName } = params
  
  // 1. Fetch Market Data (Skip if already provided by local proxy)
  let marketData = params.marketData;
  
  if (!marketData) {
    console.log(`[Radar AI] Iniciando Scraper v2 para: ${productName}`)
    try {
      marketData = await smartScrapeML(productName)
    } catch (e: any) {
      console.warn(`[Radar AI] Falló Scraper v2: ${e.message}`)
      return new Response(JSON.stringify({ ok: false, error: `No se pudo obtener información de mercado: ${e.message}` }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }
  } else {
    console.log(`[Radar AI] Usando datos de mercado pre-cargados para: ${productName}`)
  }
  
  // 2. AI Analysis via Groq
  const apiKey = Deno.env.get('VITE_GROQ_API_KEY') || Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('Falta VITE_GROQ_API_KEY')

  const analysis = await analyzeWithGroq(apiKey, {
    productName: params.productName,
    price: params.price,
    market: marketData
  })

  return new Response(
    JSON.stringify({ ok: true, marketData, analysis }),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  )
}

/**
 * Smart Scrape: Universal Pattern Extractor
 */
async function smartScrapeML(term: string) {
  const query = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  // Use a more resilient search URL (sometimes the browse subdomain is less sensitive)
  const url = `https://www.mercadolibre.com.ar/jm/search?as_word=${encodeURIComponent(query)}`
  
  console.log(`[Escáner] Consultando: ${url}`)
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    }
  })

  const html = await response.text()
  
  // DIAGNÓSTICO: Si es muy corto o contiene bloqueo, avisar.
  if (html.length < 3000 || html.includes('captcha') || html.includes('Protección contra bots') || html.includes('suspicious-traffic-frontend')) {
     const snippet = html.substring(0, 1000).replace(/<[^>]*>/g, ' ').trim()
     console.error(`[Radar AI] Bloqueo detectado. Snippet: ${snippet}`)
     throw new Error(`LA IA NO FUNCIONA (Bloqueo de Mercado Libre): El sitio detectó la consulta como automatizada. Fragmento: "${snippet}..."`)
  }

  // PATRÓN ULTRA-PERMISIVO DE PRECIOS
  // Busca el símbolo $ seguido de dígitos y puntos
  const prices: number[] = []
  const priceRegex = /\$\s?([\d\.]+)/g
  let pMatch;
  while ((pMatch = priceRegex.exec(html)) !== null) {
    const val = parseInt(pMatch[1].replace(/\./g, ''))
    // Filtramos ruidos: precios muy bajos (ej. $10) o muy altos que no tengan sentido
    if (val > 100) prices.push(val)
  }

  // PATRÓN DE TÍTULOS (Buscamos etiquetas h2 que suelen ser los nombres)
  const titles: string[] = []
  const titleRegex = /<h2[^>]*>([^<]+)<\/h2>/g
  let tMatch;
  while ((tMatch = titleRegex.exec(html)) !== null) {
     const text = tMatch[1].trim()
     if (text.length > 5 && !text.includes('{')) titles.push(text)
  }

  console.log(`[Escáner] Hallazgos: ${prices.length} potenciales precios, ${titles.length} potenciales títulos.`)

  if (prices.length < 2) {
    const snippet = html.substring(0, 500).replace(/\s+/g, ' ')
    throw new Error(`DATOS NO ENCONTRADOS: Mercado Libre cambió su estructura o devolvió una página vacía. Fragmento: ${snippet}`)
  }

  // Filtrar precios
  const uniquePrices = Array.from(new Set(prices)).sort((a, b) => a - b)
  const filteredPrices = uniquePrices.filter(p => p > 300) 

  if (filteredPrices.length === 0) {
    throw new Error('No se detectaron precios válidos en la página de mercado.')
  }

  const avg = filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length

  return {
    avg,
    min: Math.min(...filteredPrices),
    max: Math.max(...filteredPrices),
    sample_size: filteredPrices.length,
    samples: titles.slice(0, 5).map((t, i) => ({
      title: t,
      price: filteredPrices[i] || avg,
      permalink: url
    }))
  }
}

async function analyzeWithGroq(apiKey: string, data: any) {
  const prompt = `PRODUCTO: ${data.productName}
PRECIO STOCKIA: $${data.price}
COMPETENCIA: Promedio $${data.market.avg}, Min $${data.market.min}, Max $${data.market.max}

Responde en español con este formato exacto:
📊 Diagnóstico: ...
⚠️ Problemas: ...
💡 Oportunidades: ...
📈 Recomendaciones: ...
💰 Impacto estimado: ...`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: 'Sos un asesor de negocios experto.' }, { role: 'user', content: prompt }],
      temperature: 0.5,
    })
  })

  const resData = await response.json()
  
  if (!response.ok) {
     throw new Error(resData?.error?.message || 'Error en Groq API')
  }

  if (!resData.choices || resData.choices.length === 0) {
     throw new Error('La IA no devolvió ninguna respuesta. Intenta de nuevo.')
  }

  return resData.choices[0].message.content
}

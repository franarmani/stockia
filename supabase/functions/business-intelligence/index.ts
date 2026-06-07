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
  const { productName, price } = params
  
  console.log(`[Radar AI] Iniciando Orquestador Universal para: ${productName}`)
  
  // 1. Ejecutar búsquedas en paralelo (los "Gigantes")
  const sources = [
    { name: 'Mercado Libre', type: 'ml' },
    { name: 'Carrefour', type: 'vtex', domain: 'www.carrefour.com.ar' },
    { name: 'Jumbo', type: 'vtex', domain: 'www.jumbo.com.ar' },
    { name: 'Easy', type: 'vtex', domain: 'www.easy.com.ar' }
  ]

  const results = await Promise.allSettled(sources.map(s => {
    if (s.type === 'ml') return smartScrapeML(productName)
    if (s.type === 'vtex') return smartScrapeVtex(s.domain!, productName)
    return Promise.reject('Tipo desconocido')
  }))

  // 2. Consolidar resultados
  const allSamples: any[] = []
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      const sourceName = sources[i].name
      res.value.samples.forEach((s: any) => allSamples.push({ ...s, source: sourceName }))
    }
  })

  if (allSamples.length === 0) {
    throw new Error('No se encontraron referencias en ninguna de las tiendas consultadas.')
  }

  // Cálculos consolidados
  const prices = allSamples.map(s => s.price)
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  
  const marketData = {
    avg,
    min: Math.min(...prices),
    max: Math.max(...prices),
    sample_size: allSamples.length,
    samples: allSamples.slice(0, 10), // Tomamos un mix de todas las fuentes
    sources: results.map((r, i) => ({ name: sources[i].name, ok: r.status === 'fulfilled' }))
  }

  // 3. AI Analysis via Groq
  const apiKey = Deno.env.get('VITE_GROQ_API_KEY') || Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('Falta VITE_GROQ_API_KEY')

  const analysis = await analyzeWithGroq(apiKey, {
    productName,
    price,
    market: marketData
  })

  return new Response(
    JSON.stringify({ ok: true, marketData, analysis }),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  )
}

/**
 * Módulo Mercado Libre
 */
async function smartScrapeML(term: string) {
  const query = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  const url = `https://www.mercadolibre.com.ar/search?keywords=${encodeURIComponent(query)}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/'
    }
  })

  const html = await response.text()
  if (html.includes('suspicious-traffic-frontend') || html.length < 5000) {
    throw new Error('Bloqueo temporal en Mercado Libre')
  }

  const prices: number[] = []
  const priceRegex = /<span class="andes-money-amount__fraction"[^>]*>([\d\.]+)<\/span>/g
  let pMatch;
  while ((pMatch = priceRegex.exec(html)) !== null) {
    const val = parseInt(pMatch[1].replace(/\./g, ''))
    if (val > 100) prices.push(val)
  }

  const titles: string[] = []
  const titleRegex = /<h2[^>]*class="[^"]*ui-search-item__title[^"]*"[^>]*>([^<]+)<\/h2>/g
  let tMatch;
  while ((tMatch = titleRegex.exec(html)) !== null) {
    titles.push(tMatch[1].trim())
  }

  return {
    samples: titles.slice(0, 3).map((t, i) => ({ title: t, price: prices[i] || 0 }))
  }
}

/**
 * Módulo VTEX (Carrefour, Jumbo, Easy)
 */
async function smartScrapeVtex(domain: string, term: string) {
  // Las tiendas VTEX exponen una API pública de búsqueda muy potente
  const url = `https://${domain}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=3`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  })

  if (!response.ok) throw new Error(`Error en API ${domain}`)
  
  const products = await response.json()
  if (!Array.isArray(products) || products.length === 0) throw new Error('Sin stock')

  return {
    samples: products.map(p => {
      // Extraer precio del primer ítem/vendedor (lógica VTEX standard)
      const seller = p.items?.[0]?.sellers?.[0]
      const price = seller?.commertialOffer?.Price || 0
      return {
        title: p.productName,
        price,
        permalink: p.link
      }
    }).filter(s => s.price > 0)
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

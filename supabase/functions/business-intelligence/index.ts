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
  const cleanQuery = query.replace(/\s+/g, '-')
  
  // Lista de URLs para intentar en caso de bloqueo - Solo dominios estables
  const targetUrls = [
    `https://www.mercadolibre.com.ar/search?keywords=${encodeURIComponent(query)}`,
    `https://www.mercadolibre.com.ar/jm/search?as_word=${encodeURIComponent(query)}`
  ]

  let lastError = null;
  
  for (const url of targetUrls) {
    try {
      console.log(`[Escáner] Intentando con URL: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
          'Referer': 'https://www.google.com/',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      })

      const html = await response.text()
      
      // Si detectamos bloqueo de Akamai/Suspicious Traffic, intentamos con la siguiente URL
      if (html.includes('suspicious-traffic-frontend') || html.includes('captcha') || html.length < 5000) {
        console.warn(`[Radar AI] Bloqueo detectado en ${url}. Probando alternativa...`)
        continue;
      }

      // PATRÓN DE PRECIOS - Más robusto (buscamos precios que suelen estar dentro de etiquetas de moneda)
      const prices: number[] = []
      // Buscamos patrones como class="andes-money-amount__fraction" o simplemente el símbolo $
      const priceRegex = /<span class="andes-money-amount__fraction"[^>]*>([\d\.]+)<\/span>/g
      let pMatch;
      while ((pMatch = priceRegex.exec(html)) !== null) {
        const val = parseInt(pMatch[1].replace(/\./g, ''))
        if (val > 100) prices.push(val)
      }

      // Fallback a regex genérico si el específico falla
      if (prices.length < 5) {
        const genericPriceRegex = /\$\s?([\d\.]+)/g
        let gMatch;
        while ((gMatch = genericPriceRegex.exec(html)) !== null) {
          const val = parseInt(gMatch[1].replace(/\./g, ''))
          if (val > 100) prices.push(val)
        }
      }

      // PATRÓN DE TÍTULOS
      const titles: string[] = []
      const titleRegex = /<h2[^>]*class="[^"]*ui-search-item__title[^"]*"[^>]*>([^<]+)<\/h2>/g
      let tMatch;
      while ((tMatch = titleRegex.exec(html)) !== null) {
        titles.push(tMatch[1].trim())
      }
      
      // Fallback de títulos
      if (titles.length < 3) {
        const altTitleRegex = /<h2[^>]*>([^<]+)<\/h2>/g
        let atMatch;
        while ((atMatch = altTitleRegex.exec(html)) !== null) {
          const text = atMatch[1].trim()
          if (text.length > 10 && !text.includes('{')) titles.push(text)
        }
      }

      console.log(`[Escáner] Éxito en ${url}: ${prices.length} precios, ${titles.length} títulos.`)

      if (prices.length >= 2) {
        const uniquePrices = Array.from(new Set(prices)).sort((a, b) => a - b)
        const avg = uniquePrices.reduce((a, b) => a + b, 0) / uniquePrices.length

        return {
          avg,
          min: Math.min(...uniquePrices),
          max: Math.max(...uniquePrices),
          sample_size: uniquePrices.length,
          samples: titles.slice(0, 5).map((t, i) => ({
            title: t,
            price: uniquePrices[i] || avg,
            permalink: url
          }))
        }
      }
      
      console.warn(`[Radar AI] Estructura incompleta en ${url}. Probando alternativa...`)
    } catch (e: any) {
      lastError = e;
      console.warn(`[Radar AI] Error en ${url}: ${e.message}`)
    }
  }

  throw new Error(lastError?.message || 'Mercado Libre está bloqueando las consultas automatizadas. Intenta con un nombre de producto más específico.')
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

import { supabase } from '@/lib/supabase'

export interface MarketData {
  avg: number
  min: number
  max: number
  sample_size: number
  samples: { title: string; price: number; permalink: string }[]
}

export interface AnalysisResult {
  diagnosis: string
  problems: string[]
  opportunities: string[]
  recommendations: string[]
  impact: string
}

/**
 * Fetches market data and AI analysis via Supabase Edge Function
 * This bypasses 403/CORS errors encountered in the browser.
 */
export async function analyzeProductIntelligence(params: {
  productName: string
  category: string
  price: number
  cost: number
  margin: number
  salesLast2Weeks: number
  unitsSold: number
  trend: 'sube' | 'baja' | 'estable'
}): Promise<{ marketData: MarketData; analysis: AnalysisResult }> {
  try {
    console.log('[Radar AI] Iniciando flujo Híbrido...');

    let marketData = null;

    // 1. Intentar obtener datos a través del Proxy Local (Tu máquina)
    try {
      console.log('[Radar AI] Consultando Proxy Local (localhost:3001)...');
      const localResponse = await fetch('http://localhost:3001/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: params.productName })
      });

      if (localResponse.ok) {
        const localResult = await localResponse.json();
        if (localResult.ok) {
          console.log('[Radar AI] Datos de mercado obtenidos localmente.');
          marketData = localResult.data;
        }
      }
    } catch (e) {
      console.warn('[Radar AI] Proxy Local no detectado o falló. Usando fallback en la nube.', e);
    }

    // 2. Llamar a la Edge Function para el análisis de IA
    console.log('[Radar AI] Solicitando análisis a la IA (Supabase)...');
    const { data, error } = await supabase.functions.invoke('business-intelligence', {
      body: { 
        action: 'analyze-product',
        params: {
          ...params,
          marketData // Pasamos los datos recolectados localmente
        } 
      }
    })

    console.log('[Radar AI] Respuesta final:', { data, error });

    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibió respuesta del servidor.');
    if (!data.ok) throw new Error(data.error || 'Error desconocido en el servidor.');

    // Validar datos de mercado (son obligatorios para el radar)
    if (!data.marketData) {
       console.error('[Radar AI] Faltan datos de mercado:', data);
       throw new Error('No se pudieron obtener referencias de mercado.');
    }

    // Análisis de IA (ahora opcional: si falla, seguimos mostrando el radar)
    let analysis = {
      diagnosis: 'Análisis de IA temporalmente no disponible.',
      problems: ['No se pudo generar el diagnóstico automático.'],
      opportunities: ['Verificar precios manualmente en el radar.'],
      recommendations: ['Utilizar los datos de promedio y muestras para ajustar el precio.'],
      impact: 'Información no disponible.'
    };

    if (data.analysis) {
      try {
        analysis = parseAIResponse(data.analysis);
      } catch (e) {
        console.warn('[Radar AI] Error parseando respuesta de IA:', e);
      }
    }

    return {
      marketData: data.marketData,
      analysis
    }
  } catch (error: any) {
    console.error('[Radar AI Fallo]:', error);
    throw error;
  }
}

/**
 * Global analysis for the business copilot via Edge Function
 */
export async function getGlobalCopilotInsight(params: {
  totalSales: number
  productsSummary: string
  lowStock: string
  deadStock: string
  debts: string
}): Promise<AnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke('business-intelligence', {
      body: { 
        action: 'global-copilot',
        params 
      }
    })

    if (error || !data.ok) {
      throw new Error(error?.message || data.error || 'Error en el servicio del copiloto')
    }

    return parseAIResponse(data.analysis)
  } catch (error: any) {
    console.error('Error calling Global Copilot Edge Function:', error)
    throw error
  }
}

/**
 * Legacy support for direct market data if needed, but redirected to Edge Function
 */
export async function getMarketPrices(term: string): Promise<MarketData> {
  const { data, error } = await supabase.functions.invoke('business-intelligence', {
    body: { 
      action: 'analyze-product', // Reusing the analyze action just for prices if called standalone
      params: { productName: term } 
    }
  })

  if (error || !data.ok) throw new Error(error?.message || data.error)
  return data.marketData
}

function parseAIResponse(text: string): AnalysisResult {
  const sections = text.split(/\n(?=📊|⚠️|💡|📈|💰)/)
  
  const getSection = (icon: string) => {
    const section = sections.find(s => s.trim().startsWith(icon))
    if (!section) return ''
    return section.replace(/^.*?:\s*/, '').trim()
  }

  const parseList = (icon: string) => {
    const content = getSection(icon)
    return content.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
  }

  return {
    diagnosis: getSection('📊'),
    problems: parseList('⚠️'),
    opportunities: parseList('💡'),
    recommendations: parseList('📈'),
    impact: getSection('💰')
  }
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)
}

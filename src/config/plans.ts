// Planes de CajaGo. Los precios se repiten en supabase/functions/_shared/mercadopago.ts
// (el servidor es quien cobra): si cambian, cambiarlos en los dos lugares.

export type PlanId = 'basic' | 'premium' | 'vip'

/** De menor a mayor: cada plan incluye todo lo del anterior. */
export const PLAN_ORDER: PlanId[] = ['basic', 'premium', 'vip']

/** Funciones que no están en el Básico. FEATURE_PLAN dice desde qué plan se habilitan. */
export type PremiumFeature =
  | 'purchases'
  | 'accounting'
  | 'profitability'
  | 'music'
  | 'intelligence'
  | 'daily_summary'
  | 'promotions'
  | 'loyalty'
  | 'online_store'
  | 'whatsapp_ai'
  | 'quotes'
  | 'bulk_tools'

export const FEATURE_PLAN: Record<PremiumFeature, Exclude<PlanId, 'basic'>> = {
  quotes: 'premium',
  bulk_tools: 'premium',
  purchases: 'premium',
  profitability: 'premium',
  promotions: 'premium',
  loyalty: 'premium',
  music: 'premium',
  daily_summary: 'premium',
  accounting: 'vip',
  online_store: 'vip',
  intelligence: 'vip',
  whatsapp_ai: 'vip',
}

export interface Plan {
  id: PlanId
  name: string
  price: number
  priceLabel: string
  tagline: string
  features: string[]
  upcoming: string[]
}

export const PLAN_PRICES: Record<PlanId, number> = {
  basic: 38000,
  premium: 70000,
  vip: 110000,
}

/** Topes por plan (null = sin límite). El servidor aplica los mismos. */
export const PLAN_LIMITS: Record<PlanId, { products: number | null; users: number | null }> = {
  basic: { products: 500, users: 2 },
  premium: { products: null, users: 5 },
  vip: { products: null, users: null },
}

export const BASIC_LIMITS = PLAN_LIMITS.basic as { products: number; users: number }

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'Básico',
    price: PLAN_PRICES.basic,
    priceLabel: '$38.000 / mes',
    tagline: 'Para vender, cobrar y facturar.',
    features: [
      'Punto de venta sin límite de ventas',
      `Hasta ${BASIC_LIMITS.products} productos con lector de código de barras`,
      'Caja diaria con apertura, cierre y arqueo',
      'Clientes y cuenta corriente',
      'Facturación electrónica ARCA (A, B y C)',
      'Reportes de ventas',
      'Programa para Windows que funciona sin internet',
      `Hasta ${BASIC_LIMITS.users} usuarios`,
      'Soporte por WhatsApp',
    ],
    upcoming: [],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: PLAN_PRICES.premium,
    priceLabel: '$70.000 / mes',
    tagline: 'Para vender más y controlar el negocio.',
    features: [
      'Todo lo del plan Básico',
      `Productos ilimitados y hasta ${PLAN_LIMITS.premium.users} usuarios`,
      'Presupuestos en PDF y por WhatsApp',
      'Importación desde Excel, aumentos masivos y etiquetas',
      'Compras, proveedores y libro de IVA compras',
      'Rentabilidad por producto, categoría y material',
      'Promociones: 2x1, 3x2, % off y 2da unidad',
      'Club de puntos con premios para tus clientes',
      'Límite de crédito y calificación de clientes',
      'Cobro con QR de Mercado Pago en la caja',
      'CajaGo Music: música para tu local',
      'Resumen diario del negocio',
    ],
    upcoming: [],
  },
  vip: {
    id: 'vip',
    name: 'VIP',
    price: PLAN_PRICES.vip,
    priceLabel: '$110.000 / mes',
    tagline: 'La gestión completa, con IA y atención prioritaria.',
    features: [
      'Todo lo del plan Premium',
      'Usuarios ilimitados',
      'Contabilidad: plan de cuentas, libro diario y mayor',
      'Tienda online con pedidos por WhatsApp',
      'Análisis inteligente del negocio con IA',
      'Varias sucursales vinculadas',
      'Soporte prioritario',
    ],
    upcoming: [
      'WhatsApp con IA: tu propio número atendiendo consultas y pedidos',
    ],
  },
}

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeature, string> = {
  purchases: 'Compras y proveedores',
  accounting: 'Contabilidad',
  profitability: 'Rentabilidad',
  music: 'CajaGo Music',
  intelligence: 'Análisis inteligente con IA',
  daily_summary: 'Resumen diario',
  promotions: 'Promociones',
  loyalty: 'Club de puntos',
  online_store: 'Tienda online',
  whatsapp_ai: 'WhatsApp con IA',
  quotes: 'Presupuestos',
  bulk_tools: 'Importación, aumentos masivos y etiquetas',
}

/** Valores viejos (pro, free) y vacío cuentan como Premium. */
export function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === 'basic' || plan === 'vip') return plan
  return 'premium'
}

export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan)
}

export function getPlanById(id: string | null | undefined): Plan {
  return PLANS[normalizePlan(id)]
}

export function formatPlanPrice(amount: number): string {
  return '$' + amount.toLocaleString('es-AR')
}

// Planes de CajaGo. Los precios se repiten en supabase/functions/_shared/mercadopago.ts
// (el servidor es quien cobra): si cambian, cambiarlos en los dos lugares.

export type PlanId = 'basic' | 'premium'

/** Funciones que solo están en Premium (y en la prueba gratis). */
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
}

/** Topes del plan Básico. Premium y la prueba gratis no tienen límites. */
export const BASIC_LIMITS = {
  products: 500,
  users: 2,
}

const basicFeatures = [
  'Punto de venta sin límite de ventas',
  `Hasta ${BASIC_LIMITS.products} productos con lector de código de barras`,
  'Caja diaria con apertura, cierre y arqueo',
  'Clientes y cuenta corriente',
  'Facturación electrónica ARCA (A, B y C)',
  'Reportes de ventas',
  'Programa para Windows que funciona sin internet',
  `Hasta ${BASIC_LIMITS.users} usuarios (vos y un vendedor)`,
  'Soporte por WhatsApp',
]

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'Básico',
    price: PLAN_PRICES.basic,
    priceLabel: '$38.000 / mes',
    tagline: 'Todo para vender, cobrar y facturar.',
    features: basicFeatures,
    upcoming: [],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: PLAN_PRICES.premium,
    priceLabel: '$70.000 / mes',
    tagline: 'El negocio completo: gestión, números y ambiente.',
    features: [
      'Todo lo del plan Básico, sin límites',
      'Productos y usuarios ilimitados',
      'Presupuestos en PDF y por WhatsApp',
      'Importación desde Excel, aumentos masivos y etiquetas',
      'Compras, proveedores y libro de IVA compras',
      'Contabilidad: plan de cuentas, libro diario y mayor',
      'Rentabilidad por producto, categoría y material',
      'Promociones: 2x1, 3x2, % off y 2da unidad',
      'Club de puntos con premios para tus clientes',
      'Límite de crédito y calificación de clientes',
      'Tienda online con pedidos por WhatsApp',
      'Cobro con QR de Mercado Pago en la caja',
      'CajaGo Music: música para tu local',
      'Análisis inteligente del negocio con IA',
      'Resumen diario del negocio',
      'Soporte prioritario',
    ],
    upcoming: [
      'WhatsApp IA con conexión administrada por CajaGo',
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

/** 'basic' es el único plan reducido; los valores viejos (vip, free, pro) y vacío son Premium. */
export function normalizePlan(plan: string | null | undefined): PlanId {
  return plan === 'basic' ? 'basic' : 'premium'
}

export function getPlanById(id: string | null | undefined): Plan {
  return PLANS[normalizePlan(id)]
}

export function formatPlanPrice(amount: number): string {
  return '$' + amount.toLocaleString('es-AR')
}

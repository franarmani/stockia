export interface PlanFeature {
  text: string
  included: boolean
}

export interface Plan {
  id: string
  name: string
  price: number
  priceLabel: string
  features: PlanFeature[]
  color: string
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Plan Inicial',
    price: 0,
    priceLabel: 'Gratis',
    color: 'gray',
    features: [
      { text: 'Gestión de Inventario', included: true },
      { text: 'Ventas básicas', included: true },
      { text: 'Facturación AFIP', included: false },
      { text: 'Radar de Precios AI', included: false },
    ]
  },
  vip: {
    id: 'vip',
    name: 'Plan Negocio (VIP)',
    price: 70000,
    priceLabel: '$70.000 / mes',
    color: 'primary',
    features: [
      { text: 'Facturación AFIP ilimitada', included: true },
      { text: 'Radar de Precios AI (Promo 30 días)', included: true },
      { text: 'Reportes Detallados', included: true },
      { text: 'Usuarios ilimitados', included: true },
      { text: 'Soporte vía WhatsApp', included: true },
    ]
  }
}

export function getPlanById(id: string): Plan {
  return PLANS[id.toLowerCase()] || PLANS.free
}

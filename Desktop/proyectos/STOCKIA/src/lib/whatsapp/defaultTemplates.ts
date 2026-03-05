/**
 * Default WhatsApp templates seeded per business on first visit.
 */

export interface DefaultTemplate {
  name: string
  category: 'sales' | 'billing' | 'accounts' | 'marketing' | 'support'
  message: string
  sort_order: number
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Enviar ticket',
    category: 'sales',
    message:
      '¡Hola {{customer.name}}! 🛒\n\nTe envío el ticket de tu compra por {{sale.total}} del {{sale.date}}.\n\n📄 Ver ticket: {{ticket.url}}\n\n¡Gracias por tu compra!\n{{business.name}}',
    sort_order: 1,
  },
  {
    name: 'Enviar factura',
    category: 'billing',
    message:
      'Hola {{customer.name}}, te envío tu factura N° {{invoice.number}}.\n\n💰 Total: {{sale.total}}\n📄 Ver/descargar: {{invoice.pdf_url}}\n🔐 CAE: {{invoice.cae}}\n\n{{business.name}}',
    sort_order: 2,
  },
  {
    name: 'Recordatorio de pago',
    category: 'accounts',
    message:
      'Hola {{customer.name}}, te recordamos que tenés un saldo pendiente de {{customer.balance}}.\n\n📊 Ver estado de cuenta: {{statement.url}}\n\n¿Podemos coordinar el pago? ¡Gracias!\n{{business.name}}',
    sort_order: 3,
  },
  {
    name: 'Pedido listo',
    category: 'sales',
    message:
      '¡Hola {{customer.name}}! ✅\n\nTe avisamos que tu pedido ya está listo para retirar.\n\n¡Te esperamos!\n{{business.name}}',
    sort_order: 4,
  },
  {
    name: 'Promoción',
    category: 'marketing',
    message:
      '¡Hola {{customer.name}}! 🎉\n\nEn {{business.name}} tenemos ofertas especiales esta semana.\n\n📋 Ver catálogo: {{catalog.url}}\n\n¡Te esperamos!',
    sort_order: 5,
  },
  {
    name: 'Consulta de stock',
    category: 'support',
    message:
      '¡Hola {{customer.name}}! 👋\n\nTe escribimos desde {{business.name}}. ¿Necesitás algún producto? Consultanos disponibilidad y precios.\n\n📋 Catálogo: {{catalog.url}}',
    sort_order: 6,
  },
  {
    name: 'Enviar catálogo',
    category: 'marketing',
    message:
      '¡Hola {{customer.name}}! 📋\n\nTe compartimos nuestro catálogo actualizado:\n\n{{catalog.url}}\n\n¡Consultanos por cualquier producto!\n{{business.name}}',
    sort_order: 7,
  },
  {
    name: 'Agradecimiento',
    category: 'sales',
    message:
      '¡Hola {{customer.name}}! 🙏\n\nDesde {{business.name}} queremos agradecerte por tu compra. ¡Esperamos verte pronto!\n\nFecha: {{today}}',
    sort_order: 8,
  },
]

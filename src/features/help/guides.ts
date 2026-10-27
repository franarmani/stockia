// Guías paso a paso que se ven en Ayuda. Cada una lleva a la pantalla donde se hace.

export interface Guide {
  id: string
  title: string
  category: 'Empezar' | 'Vender' | 'Mercadería' | 'Clientes' | 'Caja y números' | 'Vender más' | 'Cuenta'
  path?: string
  steps: string[]
  tip?: string
}

export const GUIDES: Guide[] = [
  {
    id: 'primer-producto', category: 'Empezar', title: 'Cargar tus productos', path: '/products',
    steps: [
      'Entrá a Productos y stock y tocá "Nuevo producto".',
      'Completá nombre, precio de venta y, si querés, costo, código de barras y stock.',
      'Guardá. Ya lo podés vender en la caja, también sin internet.',
    ],
    tip: 'Si tenés muchos productos en Excel, usá "Importar": la IA reconoce las columnas sola (Premium).',
  },
  {
    id: 'primera-venta', category: 'Vender', title: 'Hacer una venta', path: '/pos',
    steps: [
      'Tocá "Nueva venta" (o la tecla F1).',
      'Escaneá el código de barras o buscá el producto por nombre.',
      'Elegí el medio de pago y tocá "Cobrar".',
      'Imprimí el ticket o mandalo por WhatsApp.',
    ],
  },
  {
    id: 'precio-mayorista', category: 'Vender', title: 'Vender a precio mayorista', path: '/products',
    steps: [
      'En el producto cargá "Precio mayorista" y, si querés, "Mayorista desde (cantidad)".',
      'Para que un cliente compre siempre a ese precio, en Clientes marcá "Cliente mayorista".',
      'En la caja el precio cambia solo al elegir ese cliente o al llegar a la cantidad mínima.',
    ],
  },
  {
    id: 'anular-venta', category: 'Vender', title: 'Anular una venta', path: '/sales',
    steps: [
      'Entrá a Historial de ventas y abrí la venta.',
      'Tocá "Anular venta". El stock vuelve y se descuenta de la cuenta corriente si era a cuenta.',
      'Si no sos administrador, te va a pedir el código de encargado.',
    ],
  },
  {
    id: 'consumo-empleado', category: 'Vender', title: 'Registrar un consumo de empleado', path: '/pos',
    steps: [
      'Armá la venta con lo que se lleva el empleado.',
      'Tocá el botón de la taza, arriba de la venta actual.',
      'Poné quién lo retira. Se descuenta el stock sin cobrar y aparece en el cierre de caja al costo.',
    ],
  },
  {
    id: 'depositos', category: 'Mercadería', title: 'Tener stock en depósitos', path: '/depositos',
    steps: [
      'Entrá a Depósitos y creá uno (por ejemplo "Galpón").',
      'En cada producto tocá "Mover" para pasar mercadería del Local al depósito o al revés.',
      'Con "Contar" cargás lo que contaste en un depósito y el stock total se ajusta solo.',
    ],
    tip: 'El Local es lo que se vende en la caja: el total menos lo que está guardado en depósitos.',
  },
  {
    id: 'aumentos', category: 'Mercadería', title: 'Aumentar precios por categoría', path: '/products',
    steps: [
      'En Productos tocá "Precios por categoría".',
      'Elegí la categoría, el porcentaje o monto y si querés redondear.',
      'Revisá la vista previa y tocá "Aplicar".',
    ],
  },
  {
    id: 'compra-ia', category: 'Mercadería', title: 'Cargar una factura de compra con IA', path: '/purchases',
    steps: [
      'En Compras tocá "Nuevo comprobante".',
      'Arriba, "Subir factura": elegí la foto o el PDF.',
      'Se completan proveedor, número, fecha y artículos. Revisá y guardá.',
    ],
  },
  {
    id: 'cuenta-corriente', category: 'Clientes', title: 'Vender a cuenta corriente y cobrar', path: '/customers',
    steps: [
      'En la venta elegí el cliente y el medio de pago "Cuenta corriente".',
      'Cuando te pague, en Clientes tocá "Registrar pago".',
      'En el historial del cliente podés descargar el estado de cuenta en PDF o Excel.',
    ],
  },
  {
    id: 'cierre-caja', category: 'Caja y números', title: 'Abrir y cerrar la caja', path: '/cash-register',
    steps: [
      'Al empezar el día tocá "Abrir caja" y poné el efectivo inicial.',
      'Durante el día podés registrar retiros e ingresos.',
      'Al cerrar, contá el efectivo y cargalo: el programa te muestra la diferencia y los productos vendidos.',
    ],
    tip: 'Si te olvidás de cerrar, elegí una hora de "Cierre automático" en la pantalla de Caja.',
  },
  {
    id: 'reportes', category: 'Caja y números', title: 'Ver cuánto ganaste', path: '/reports',
    steps: [
      'En Reportes elegí el período.',
      'Descargá el reporte mensual en PDF con ventas, ganancia y productos más vendidos.',
    ],
  },
  {
    id: 'promociones', category: 'Vender más', title: 'Crear una promoción', path: '/promociones',
    steps: [
      'En Promociones tocá "Nueva promoción".',
      'Elegí el tipo: 2x1, % de descuento, 2da unidad o descuento por monto (por ejemplo 15% desde $50.000).',
      'Elegí a qué productos aplica y desde cuándo. Se aplica sola en la caja.',
    ],
  },
  {
    id: 'tienda', category: 'Vender más', title: 'Armar la tienda online', path: '/tienda',
    steps: [
      'En Tienda online activala y elegí el link.',
      'Subí la portada y las fotos de los productos. Con la estrella destacás los que querés que aparezcan primero.',
      'Compartí el link: los pedidos llegan con la forma de entrega y los cobrás en la caja.',
    ],
  },
  {
    id: 'usuarios', category: 'Cuenta', title: 'Sumar empleados y el código de encargado', path: '/settings',
    steps: [
      'En Configuración → Usuarios tocá "Agregar".',
      'Elegí el rol: Vendedor, Vendedor Jr (solo vende) o Administrador.',
      'Abajo cargá el código de encargado: lo piden para anular ventas y para que el Vendedor Jr quite productos.',
    ],
  },
  {
    id: 'sin-internet', category: 'Cuenta', title: 'Trabajar sin internet',
    steps: [
      'CajaGo sigue vendiendo aunque se corte internet: todo queda guardado en la computadora.',
      'Cuando vuelve la conexión, se envía solo. Arriba ves si quedan cambios pendientes.',
      'Algunas cosas necesitan internet: anular ventas, leer facturas con IA y ver otros locales.',
    ],
  },
]

/** Busca por título, pasos y consejos, sin importar tildes ni mayúsculas. */
export function searchGuides(query: string, guides: Guide[] = GUIDES): Guide[] {
  const norm = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return guides
  return guides.filter((guide) => {
    const haystack = norm([guide.title, guide.category, ...guide.steps, guide.tip ?? ''].join(' '))
    return terms.every((term) => haystack.includes(term))
  })
}

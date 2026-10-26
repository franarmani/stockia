// Rubros de negocio que se eligen al registrarse (y se pueden cambiar en Configuración).

export const BUSINESS_TYPES = [
  { id: 'almacen', label: 'Almacén / Despensa' },
  { id: 'kiosco', label: 'Kiosco / Maxikiosco' },
  { id: 'autoservicio', label: 'Autoservicio / Minimercado' },
  { id: 'verduleria', label: 'Verdulería / Frutería' },
  { id: 'carniceria', label: 'Carnicería / Pollería' },
  { id: 'panaderia', label: 'Panadería / Confitería' },
  { id: 'dietetica', label: 'Dietética / Almacén natural' },
  { id: 'bebidas', label: 'Vinoteca / Distribuidora de bebidas' },
  { id: 'ferreteria', label: 'Ferretería' },
  { id: 'corralon', label: 'Corralón / Materiales de construcción' },
  { id: 'pintureria', label: 'Pinturería' },
  { id: 'electricidad', label: 'Casa de electricidad / Iluminación' },
  { id: 'autopartes', label: 'Repuestos / Autopartes / Lubricentro' },
  { id: 'indumentaria', label: 'Indumentaria / Calzado' },
  { id: 'libreria', label: 'Librería / Papelería' },
  { id: 'jugueteria', label: 'Juguetería / Regalería' },
  { id: 'bazar', label: 'Bazar / Hogar' },
  { id: 'perfumeria', label: 'Perfumería / Cosmética' },
  { id: 'farmacia', label: 'Farmacia / Óptica' },
  { id: 'petshop', label: 'Pet shop / Forrajería' },
  { id: 'tecnologia', label: 'Tecnología / Celulares / Electrónica' },
  { id: 'gastronomia', label: 'Gastronomía / Rotisería' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'otro', label: 'Otro rubro' },
] as const

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]['id']

export function businessTypeLabel(id: string | null | undefined): string | null {
  return BUSINESS_TYPES.find((type) => type.id === id)?.label ?? null
}

export const AR_PROVINCES = [
  'Buenos Aires', 'Capital Federal', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta',
  'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
] as const

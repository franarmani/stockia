/**
 * Acceso a las tablas de presupuestos.
 *
 * Los tipos de src/types/database.ts se generaron antes de crear `quotes` y
 * `quote_items`, así que el cliente tipado no las conoce y rechaza cualquier
 * insert/update sobre ellas. Hasta que se regeneren los tipos, todo el acceso
 * pasa por acá con el cast aislado en un solo lugar.
 */

import { supabase } from '@/lib/supabase'

/** Cliente sin tipar, solo para las tablas de presupuestos. */
export const quotesDb = supabase as any

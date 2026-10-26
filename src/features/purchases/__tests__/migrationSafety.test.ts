import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261021000000_purchases_accounting.sql'), 'utf8')
const schemaSection = migration.split('CREATE OR REPLACE FUNCTION public.seed_purchases_accounting')[0]

describe('migracion compras y contabilidad', () => {
  it('no reescribe ni elimina datos existentes durante el DDL', () => {
    expect(schemaSection).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b|UPDATE\s+public\.(suppliers|purchases)/i)
    expect(schemaSection).not.toMatch(/DROP\s+(TABLE|COLUMN)\b/i)
  })

  it('protege CUIT y comprobantes duplicados', () => {
    expect(migration).toContain('suppliers_business_cuit_uidx')
    expect(migration).toMatch(/business_id, supplier_id, document_type, point_of_sale, document_number/)
    expect(migration).toContain('purchases_document_uidx')
  })

  it('usa tipos exactos para importes financieros', () => {
    expect(migration).toMatch(/NUMERIC\(18,2\)/)
    expect(migration).not.toMatch(/\bFLOAT\b|\bREAL\b|DOUBLE\s+PRECISION/i)
  })

  it('habilita RLS y limita funciones security definer', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL ON FUNCTION')
    expect(migration).toContain('security_invoker = true')
    expect(migration).toContain("public.has_permission('purchases.manage')")
    expect(migration).toContain("public.has_permission('accounting.manage')")
  })

  it('valida referencias cross-tenant dentro de las RPC', () => {
    expect(migration).toContain('Producto invalido o perteneciente a otro negocio')
    expect(migration).toContain('Impuesto invalido o perteneciente a otro negocio')
    expect(migration).toContain('Cliente invalido o perteneciente a otro negocio')
  })
})

describe('adaptador ARCA', () => {
  const edgeFunction = readFileSync(resolve(process.cwd(), 'supabase/functions/arca-supplier-lookup/index.ts'), 'utf8')

  it('lee credenciales solo desde secretos del servidor', () => {
    expect(edgeFunction).toContain("Deno.env.get('ARCA_PADRON_ENDPOINT')")
    expect(edgeFunction).toContain("Deno.env.get('ARCA_PADRON_ACCESS_TOKEN')")
  })

  it('define timeout y fallback manual', () => {
    expect(edgeFunction).toContain('ARCA_TIMEOUT_MS')
    expect(edgeFunction).toContain('controller.abort()')
    expect(edgeFunction).toContain('Continúe con la carga manual')
  })
})

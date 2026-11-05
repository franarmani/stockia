import { describe, expect, it, vi } from 'vitest'
import { isValidCuit, normalizeCuit } from '../cuit'
import { saveSupplier } from '../purchasesService'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/sync/syncEngine', () => {
  const rows: any[] = []
  return {
    syncEngine: {
      pullRows: vi.fn().mockImplementation(() => Promise.resolve(rows)),
      createRow: vi.fn().mockImplementation((_table: string, _bId: string, data: any) => {
        rows.push(data)
        return Promise.resolve(data)
      }),
      updateRow: vi.fn().mockImplementation((_table: string, _bId: string, id: string, data: any) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx !== -1) rows[idx] = { ...rows[idx], ...data }
        return Promise.resolve(rows[idx])
      }),
    },
  }
})

describe('proveedores informales y compras sin CUIT', () => {
  it('permite registrar proveedor sin CUIT ni razón social fiscal (solo nombre)', async () => {
    const supplier = await saveSupplier('b1', {
      name: 'Distribuidora Juan (Sin CUIT)',
      cuit: '',
    })

    expect(supplier.name).toBe('Distribuidora Juan (Sin CUIT)')
    expect(supplier.legal_name).toBe('Distribuidora Juan (Sin CUIT)')
    expect(supplier.cuit).toBeNull()
    expect(supplier.vat_condition).toBe('Consumidor Final')
  })

  it('permite guardar con cuit vacío o undefined sin arrojar error', async () => {
    const supplier = await saveSupplier('b1', {
      name: 'Proveedor Informal',
      cuit: null,
    })

    expect(supplier.cuit).toBeNull()
    expect(supplier.name).toBe('Proveedor Informal')
  })

  it('valida el CUIT únicamente si se ingresó uno', async () => {
    await expect(
      saveSupplier('b1', {
        name: 'Proveedor Con Cuit Falso',
        cuit: '20-12345678-9',
      })
    ).rejects.toThrow(/El CUIT no es válido/)
  })

  it('guarda exitosamente si se ingresa un CUIT válido formal', async () => {
    const supplier = await saveSupplier('b1', {
      legal_name: 'Empresa SA',
      cuit: '20-12345678-6',
    })

    expect(supplier.cuit).toBe('20123456786')
    expect(supplier.legal_name).toBe('Empresa SA')
  })
})


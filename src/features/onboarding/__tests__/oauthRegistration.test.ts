import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
let rpcResults: Record<string, boolean> = {}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'Ana@Correo.com' } } } }) },
    rpc: async (name: string) => ({ data: rpcResults[name] ?? false, error: null }),
    from: (table: string) => ({
      insert: (row: any) => {
        calls.push(`insert:${table}:${row.id ?? ''}`)
        return { select: () => ({ single: async () => ({ data: { id: 'b1' }, error: null }) }), then: (r: any) => r({ error: null }) }
      },
    }),
  },
}))

import { completeOAuthRegistration, emptyRegistration, isOAuthUser } from '../registration'

const valid = {
  ...emptyRegistration, businessName: 'Corralón Sur', businessType: 'corralon', phone: '2915551234', address: 'Alem 123',
  city: 'Bahía Blanca', province: 'Buenos Aires', cuit: '20-12345678-6', razonSocial: 'Ana Pérez', ivaCondition: 'monotributo', fullName: 'Ana Pérez',
}

describe('alta de negocio con Google', () => {
  beforeEach(() => { calls.length = 0; rpcResults = {} })

  it('reconoce usuarios de Google y no los de email', () => {
    expect(isOAuthUser({ app_metadata: { provider: 'google' } })).toBe(true)
    expect(isOAuthUser({ app_metadata: { provider: 'email' } })).toBe(false)
    expect(isOAuthUser(null)).toBe(false)
  })

  it('crea el negocio y el perfil con el mismo id de la cuenta', async () => {
    await completeOAuthRegistration(valid)
    expect(calls).toEqual(['insert:businesses:', 'insert:users:u1'])
  })

  it('no crea nada si la persona ya tiene perfil', async () => {
    rpcResults = { i_have_profile: true }
    await expect(completeOAuthRegistration(valid)).rejects.toThrow(/ya tiene un negocio/i)
    expect(calls).toEqual([])
  })

  it('no duplica si ya existe otra cuenta con ese email', async () => {
    rpcResults = { email_has_other_account: true }
    await expect(completeOAuthRegistration(valid)).rejects.toThrow(/Ya existe una cuenta/i)
    expect(calls).toEqual([])
  })

  it('valida los datos antes de tocar la base', async () => {
    await expect(completeOAuthRegistration({ ...valid, businessName: '' })).rejects.toThrow()
    expect(calls).toEqual([])
  })
})

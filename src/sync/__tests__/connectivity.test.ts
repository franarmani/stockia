import { beforeEach, describe, expect, it, vi } from 'vitest'

const ping = vi.hoisted(() => ({ result: true }))
vi.mock('@/lib/supabase', () => ({ pingSupabase: vi.fn(async () => ping.result) }))

async function loadConnectivity() {
  vi.resetModules()
  return import('../connectivity')
}

describe('real connectivity (network + Supabase reachable)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ping.result = true
  })

  it('is offline when Supabase does not answer even if the network is up', async () => {
    const connectivity = await loadConnectivity()
    ping.result = false
    expect(await connectivity.checkConnectivity()).toBe(false)
    expect(connectivity.isOnline()).toBe(false)

    ping.result = true
    expect(await connectivity.checkConnectivity()).toBe(true)
    expect(connectivity.isOnline()).toBe(true)
  })

  it('goes offline immediately when a request fails for network reasons', async () => {
    const connectivity = await loadConnectivity()
    await connectivity.checkConnectivity()
    connectivity.reportNetworkFailure()
    expect(connectivity.isOnline()).toBe(false)
  })

  it('notifies listeners only when the state changes', async () => {
    const connectivity = await loadConnectivity()
    const listener = vi.fn()
    connectivity.onConnectivityChange(listener)
    await connectivity.checkConnectivity()
    ping.result = false
    await connectivity.checkConnectivity()
    await connectivity.checkConnectivity()
    ping.result = true
    await connectivity.checkConnectivity()
    expect(listener.mock.calls.map(([online]) => online)).toEqual([false, true])
  })

  it('classifies network errors apart from server errors', async () => {
    const { isNetworkError } = await loadConnectivity()
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true)
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: '' })).toBe(true)
    expect(isNetworkError(new Error('signal is aborted without reason'))).toBe(true)
    expect(isNetworkError({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})

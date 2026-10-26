import { describe, expect, it } from 'vitest'
import { detectTauriRuntime } from '../storage'

describe('desktop runtime detection', () => {
  it('detects Tauri from its injected internals', () => {
    expect(detectTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true)
    expect(detectTauriRuntime({ __TAURI__: {} })).toBe(true)
  })

  it('ignores page-settable flags that made the web look like the desktop app', () => {
    const webWithFlags = { isTauri: true, __IS_TAURI_DESKTOP__: true, location: { protocol: 'http:', hostname: 'localhost' } }
    expect(detectTauriRuntime(webWithFlags as any)).toBe(false)
  })

  it('does not mistake localhost for the desktop application', () => {
    expect(detectTauriRuntime({ location: { protocol: 'http:', hostname: 'localhost' } })).toBe(false)
    expect(detectTauriRuntime({ location: { protocol: 'https:', hostname: 'cajago.com' } })).toBe(false)
    expect(detectTauriRuntime({ navigator: { userAgent: 'Mozilla/5.0 Chrome/130' } })).toBe(false)
  })

  it('supports the native tauri protocol and packaged origin', () => {
    expect(detectTauriRuntime({ location: { protocol: 'tauri:' } })).toBe(true)
    expect(detectTauriRuntime({ location: { protocol: 'http:', hostname: 'tauri.localhost' } })).toBe(true)
  })

  it('falls back to the CajaGo desktop user agent if injection is late', () => {
    expect(detectTauriRuntime({ navigator: { userAgent: 'CajaGo-Desktop/1.0' } })).toBe(true)
  })
})

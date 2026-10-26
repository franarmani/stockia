// ── localStorage cache de la sesión (perfil, negocio y usuario para arrancar sin red) ──
const PROFILE_CACHE_KEY = 'stockia_profile'
const BUSINESS_CACHE_KEY = 'stockia_business'
const OFFLINE_USER_CACHE_KEY = 'cajago_offline_user'

export function cacheProfile(profile: any) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)) } catch {}
}
export function cacheBusiness(business: any) {
  try { localStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify(business)) } catch {}
}
const BUSINESS_VERIFIED_KEY = 'cajago_business_verified_at'
/** Momento en que la suscripción se confirmó contra el servidor. */
export function markBusinessVerified() {
  try { localStorage.setItem(BUSINESS_VERIFIED_KEY, String(Date.now())) } catch {}
}
export function getBusinessVerifiedAt(): number | null {
  try { const s = localStorage.getItem(BUSINESS_VERIFIED_KEY); return s ? Number(s) : null } catch { return null }
}
export function getCachedProfile() {
  try { const s = localStorage.getItem(PROFILE_CACHE_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
export function getCachedBusiness() {
  try { const s = localStorage.getItem(BUSINESS_CACHE_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
export function cacheOfflineUser(user: any) {
  try {
    localStorage.setItem(OFFLINE_USER_CACHE_KEY, JSON.stringify({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata || {},
      app_metadata: user.app_metadata || {},
      aud: user.aud || 'authenticated',
      created_at: user.created_at,
    }))
  } catch {}
}
export function getCachedOfflineUser() {
  try { const value = localStorage.getItem(OFFLINE_USER_CACHE_KEY); return value ? JSON.parse(value) : null } catch { return null }
}
/** Al cerrar sesión a propósito no se debe volver a entrar solo, aunque no haya conexión. */
export function clearCachedOfflineUser() {
  try { localStorage.removeItem(OFFLINE_USER_CACHE_KEY) } catch {}
}
export function clearCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(BUSINESS_CACHE_KEY)
    localStorage.removeItem(OFFLINE_USER_CACHE_KEY)
  } catch {}
}

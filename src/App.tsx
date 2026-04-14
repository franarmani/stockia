import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, lazy, Suspense, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useBusinessStore } from '@/stores/businessStore'

// Layouts
import AppShellLauncher from '@/components/layout/AppShellLauncher'
import TrialExpiredModal from '@/components/TrialExpiredModal'

// ── localStorage cache helpers ──
const PROFILE_CACHE_KEY = 'stockia_profile'
const BUSINESS_CACHE_KEY = 'stockia_business'

function cacheProfile(profile: any) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)) } catch {}
}
function cacheBusiness(business: any) {
  try { localStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify(business)) } catch {}
}
function getCachedProfile() {
  try { const s = localStorage.getItem(PROFILE_CACHE_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function getCachedBusiness() {
  try { const s = localStorage.getItem(BUSINESS_CACHE_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function clearCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); localStorage.removeItem(BUSINESS_CACHE_KEY) } catch {}
}

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const MenuLauncher = lazy(() => import('@/pages/menu/MenuLauncher'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const POSPage = lazy(() => import('@/pages/pos/POSPage'))
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'))
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage'))
const CashRegisterPage = lazy(() => import('@/pages/cash-register/CashRegisterPage'))
const SalesHistoryPage = lazy(() => import('@/pages/sales/SalesHistoryPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const PurchasesPage = lazy(() => import('@/pages/purchases/PurchasesPage'))
const ComprobantesPage = lazy(() => import('@/pages/comprobantes/ComprobantesPage'))
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const SubscriptionBlockedPage = lazy(() => import('@/pages/subscription/SubscriptionBlockedPage'))
const ProductDetailPage = lazy(() => import('@/pages/products/ProductDetailPage'))

// New feature pages
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const HealthPage = lazy(() => import('@/features/health/HealthPage'))
const DailySummaryPage = lazy(() => import('@/features/daily_summary/DailySummaryPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const MusicPage = lazy(() => import('@/pages/music/MusicPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuthStore()
  const { business } = useBusinessStore()

  // Loading OR (user exists but profile hasn't loaded yet) → show spinner
  if (loading || (user && !profile)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // No session at all → login
  if (!user) return <Navigate to="/login" replace />

  const isTrialExpired =
    business?.subscription_status === 'trial' &&
    !!business?.trial_ends_at &&
    new Date(business.trial_ends_at) < new Date()

  if (business?.subscription_status === 'expired' || isTrialExpired) {
    return (
      <>
        {children}
        <TrialExpiredModal />
      </>
    )
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuthStore()
  if (loading) return <>{children}</>
  // Only redirect to app if BOTH user and profile are loaded — prevents redirect loop
  if (user && profile) return <Navigate to="/menu" replace />
  return <>{children}</>
}

export default function App() {
  const { setUser, setLoading, setProfile } = useAuthStore()
  const { fetchBusiness, setBusiness } = useBusinessStore()

  // ── VERSION-BASED CACHE CLEAR ──
  // Increment this version to force all clients to reload and clear local caches
  const APP_VERSION = '1.3.3-music-build-fix' 
  
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion !== APP_VERSION) {
      console.log(`[Version] Updating from ${storedVersion} to ${APP_VERSION}`)
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('app_version', APP_VERSION)
      
      // Unregister all service workers to be sure
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister()
          }
        })
      }
      
      window.location.reload()
    }
  }, [APP_VERSION])

  useEffect(() => {
    // ── BULLETPROOF AUTH WITH LOCALSTORAGE CACHE ──
    // The Supabase free tier has server-side query timeouts.
    // After the first successful load, we cache profile+business in localStorage.
    // On subsequent visits / tab switches, we use the cache instantly.

    let profileLoaded = false

    function applyProfile(data: any) {
      const profile = {
        id: data.id,
        business_id: data.business_id,
        name: data.name,
        email: data.email,
        role: data.role as 'admin' | 'seller',
        is_superadmin: data.is_superadmin ?? false,
        created_at: data.created_at,
      }
      setProfile(profile)
      cacheProfile(profile)
      return profile
    }

    async function loadFromNetwork(userId: string): Promise<boolean> {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error || !data) {
          console.warn('[Auth] network query failed:', error?.message ?? 'no row')
          return false
        }

        const profile = applyProfile(data)

        // Fetch business and cache it too
        const { data: biz } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', profile.business_id)
          .single()

        if (biz) {
          setBusiness(biz)
          cacheBusiness(biz)
        }

        profileLoaded = true
        console.log('[Auth] loaded from network OK')
        return true
      } catch (e: any) {
        console.warn('[Auth] network error:', e.message)
        return false
      }
    }

    function loadFromCache(): boolean {
      const cached = getCachedProfile()
      const cachedBiz = getCachedBusiness()
      if (cached) {
        setProfile(cached)
        if (cachedBiz) setBusiness(cachedBiz)
        profileLoaded = true
        console.log('[Auth] loaded from cache')
        return true
      }
      return false
    }

    // ── Step 1: check session on mount ──
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setLoading(false)
        return
      }

      setUser(session.user)

      // Try cache first (instant)
      if (loadFromCache()) {
        setLoading(false)
        // Refresh from network in background (silent)
        loadFromNetwork(session.user.id)
        return
      }

      // No cache → must load from network (with retries)
      for (let i = 1; i <= 3; i++) {
        const ok = await loadFromNetwork(session.user.id)
        if (ok) break
        if (i < 3) await new Promise(r => setTimeout(r, i * 2000))
      }
      setLoading(false)
    })

    // ── Step 2: auth state changes ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        profileLoaded = false
        setUser(null)
        setProfile(null)
        setBusiness(null)
        clearCache()
        setLoading(false)
        return
      }

      if (!session?.user) return

      setUser(session.user)

      // Already loaded → just sync token, done
      if (profileLoaded) {
        setLoading(false)
        return
      }

      // New sign-in → try cache, then network
      if (event === 'SIGNED_IN') {
        if (loadFromCache()) {
          setLoading(false)
          loadFromNetwork(session.user.id) // silent refresh
          return
        }

        setLoading(true)
        for (let i = 1; i <= 3; i++) {
          const ok = await loadFromNetwork(session.user.id)
          if (ok) break
          if (i < 3) await new Promise(r => setTimeout(r, i * 2000))
        }
        setLoading(false)
      }
    })

    return () => { subscription.unsubscribe() }
  }, [])

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/subscription-blocked" element={<SubscriptionBlockedPage />} />

        {/* Protected — app shell launcher (no sidebar) */}
        <Route path="/" element={<ProtectedRoute><AppShellLauncher /></ProtectedRoute>}>
          <Route path="menu" element={<MenuLauncher />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="comprobantes" element={<ComprobantesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="cash-register" element={<CashRegisterPage />} />
          <Route path="sales" element={<SalesHistoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* New feature routes */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="daily-summary" element={<DailySummaryPage />} />
          <Route path="music" element={<MusicPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, lazy, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useBusinessStore } from '@/stores/businessStore'

// Layouts
import AppShellLauncher from '@/components/layout/AppShellLauncher'
import TrialExpiredModal from '@/components/TrialExpiredModal'

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

// New feature pages
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const HealthPage = lazy(() => import('@/features/health/HealthPage'))
const DailySummaryPage = lazy(() => import('@/features/daily_summary/DailySummaryPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuthStore()
  const { business } = useBusinessStore()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // No session → login
  if (!user) return <Navigate to="/login" replace />

  // Session exists but profile failed to load → login (signOut handled in useEffect above)
  if (!profile) return <Navigate to="/login" replace />

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
  const { fetchBusiness } = useBusinessStore()

  useEffect(() => {
    // ── Robust auth flow ──
    // Supabase fires multiple events (SIGNED_IN, INITIAL_SESSION, TOKEN_REFRESHED)
    // often concurrently. We use flags + debounce to prevent loops and race conditions.

    let profileLoaded = false       // true once we have a valid profile
    let loadInFlight = false        // prevents concurrent loadProfile calls
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    // Safety: if nothing resolves in 10s, just unlock loading
    const safety = setTimeout(() => {
      setLoading(false)
      console.warn('[Auth] Safety timeout fired — loading was stuck')
    }, 10000)

    async function loadProfile(userId: string): Promise<boolean> {
      // Skip if already loaded or another load is in progress
      if (profileLoaded) {
        console.log('[Auth] loadProfile skipped — already loaded')
        return true
      }
      if (loadInFlight) {
        console.log('[Auth] loadProfile skipped — already in flight')
        return false
      }

      loadInFlight = true
      console.log('[Auth] loadProfile start', userId)

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
          .abortSignal(AbortSignal.timeout(8000))

        if (error) {
          console.warn('[Auth] loadProfile query error:', error.message)
          return false
        }

        if (!data) {
          console.warn('[Auth] loadProfile: no profile found for', userId)
          return false
        }

        console.log('[Auth] loadProfile success, fetching business...')
        setProfile({
          id: data.id,
          business_id: data.business_id,
          name: data.name,
          email: data.email,
          role: data.role as 'admin' | 'seller',
          is_superadmin: (data as any).is_superadmin ?? false,
          created_at: data.created_at,
        })
        await fetchBusiness(data.business_id)
        profileLoaded = true
        console.log('[Auth] loadProfile complete')
        return true
      } catch (e: any) {
        console.warn('[Auth] loadProfile error:', e.message)
        return false
      } finally {
        loadInFlight = false
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event, !!session?.user)
      clearTimeout(safety)

      // Sign out → clear everything
      if (event === 'SIGNED_OUT') {
        profileLoaded = false
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // No session → ignore
      if (!session?.user) {
        setLoading(false)
        return
      }

      // Always keep the latest user/token in sync
      setUser(session.user)

      // If profile is already loaded, just stop loading and done
      if (profileLoaded) {
        console.log('[Auth] Profile already loaded, skipping reload')
        setLoading(false)
        return
      }

      // Debounce: Supabase fires multiple events rapidly. Wait 100ms for them to settle.
      if (debounceTimer) clearTimeout(debounceTimer)
      setLoading(true)

      debounceTimer = setTimeout(async () => {
        const success = await loadProfile(session.user.id)
        if (!success && !profileLoaded) {
          // Profile couldn't load — first time ever: redirect to login will happen via ProtectedRoute
          console.warn('[Auth] Profile load failed on initial attempt')
          setProfile(null)
        }
        setLoading(false)
      }, 150)
    })

    return () => {
      clearTimeout(safety)
      if (debounceTimer) clearTimeout(debounceTimer)
      subscription.unsubscribe()
    }
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
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

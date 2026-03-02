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
    // ── BULLETPROOF AUTH ──
    // 1. getSession() loads the profile exactly ONCE on mount
    // 2. onAuthStateChange ONLY handles: sign-out (clear) and fresh sign-in (load if not loaded)
    // 3. Once profileLoaded=true, profile is NEVER cleared or reloaded (until SIGNED_OUT)
    // 4. No AbortSignal, no timeout, no debounce — just a simple fetch

    let profileLoaded = false
    let loadPromise: Promise<void> | null = null // dedup concurrent loads

    async function loadProfileOnce(userId: string): Promise<void> {
      // Already loaded → nothing to do
      if (profileLoaded) return

      // Another call already loading → wait for it
      if (loadPromise) {
        await loadPromise
        return
      }

      loadPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle()

          if (error || !data) {
            console.warn('[Auth] profile query failed:', error?.message ?? 'no row found')
            return
          }

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
          console.log('[Auth] profile loaded OK')
        } catch (e: any) {
          console.warn('[Auth] profile load exception:', e.message)
        } finally {
          loadPromise = null
        }
      })()

      await loadPromise
    }

    // ── Step 1: initial session check on mount ──
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfileOnce(session.user.id)
      }
      setLoading(false)
    })

    // ── Step 2: listen for auth changes ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Sign out → clear everything
      if (event === 'SIGNED_OUT') {
        profileLoaded = false
        loadPromise = null
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // No session → nothing to do
      if (!session?.user) return

      // Sync the user/token (always, even on TOKEN_REFRESHED)
      setUser(session.user)

      // Profile already loaded → done, don't touch anything
      if (profileLoaded) {
        setLoading(false)
        return
      }

      // Fresh sign-in (user just logged in from LoginPage) → load profile
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(true)
        await loadProfileOnce(session.user.id)
        setLoading(false)
      }
    })

    return () => {
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

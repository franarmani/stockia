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
    // ── Simple & robust auth flow ──
    // Supabase fires many SIGNED_IN events. We load profile exactly ONCE
    // and ignore all further events. No debounce, no timeout, no races.

    let profileLoaded = false   // once true, never reload (until SIGNED_OUT)
    let loadingStarted = false  // prevents concurrent load attempts

    async function loadProfile(userId: string): Promise<boolean> {
      try {
        // 15s timeout — long enough for slow Supabase, short enough not to hang forever
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
          .abortSignal(AbortSignal.timeout(15000))

        if (error || !data) {
          console.warn('[Auth] loadProfile failed:', error?.message ?? 'no row')
          return false
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
        console.log('[Auth] profile loaded OK')
        return true
      } catch (e: any) {
        console.warn('[Auth] loadProfile exception:', e.message)
        return false
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // ── SIGNED_OUT: reset everything ──
      if (event === 'SIGNED_OUT') {
        profileLoaded = false
        loadingStarted = false
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // No session → stop loading
      if (!session?.user) {
        setLoading(false)
        return
      }

      // Always sync user token
      setUser(session.user)

      // ── Profile already loaded → done ──
      if (profileLoaded) {
        setLoading(false)
        return
      }

      // ── Another event already triggered loading → ignore this one ──
      if (loadingStarted) return

      // ── First event with a session → load profile (with retries) ──
      loadingStarted = true
      setLoading(true)

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (profileLoaded) break // another path loaded it
        const ok = await loadProfile(session.user.id)
        if (ok) {
          profileLoaded = true
          break
        }
        // Wait before retry: 1s, 2s
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1000))
        }
      }

      if (!profileLoaded) {
        console.error('[Auth] all 3 load attempts failed — clearing session')
        setProfile(null)
      }
      setLoading(false)
      loadingStarted = false
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

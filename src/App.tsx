import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, lazy, Suspense, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import SplashScreen from '@/components/SplashScreen'
import { useBusinessStore } from '@/stores/businessStore'

// Layouts
import AppShellLauncher from '@/components/layout/AppShellLauncher'
import PaymentNotificationModal from '@/components/modals/PaymentNotificationModal'
import ScrollToTop from '@/components/layout/ScrollToTop'
import { calculateRawRemainingDays, isSubscriptionExpired, resetTrustedClock } from '@/features/subscription/utils/subscriptionDates'
import SubscriptionGuard from '@/features/subscription/components/SubscriptionGuard'
import PermissionGuard from '@/components/PermissionGuard'
import PlanGate from '@/features/subscription/components/PlanGate'
import SupportWhatsAppButton from '@/components/SupportWhatsAppButton'
import UpdateModal from '@/components/desktop/UpdateModal'
import MusicDownloadPrompt from '@/features/music/MusicDownloadPrompt'
import CashAutoCloser from '@/features/cash/CashAutoCloser'
import ManagerPinModal from '@/features/roles/ManagerPinModal'
import { checkIsTauriDesktop } from '@/sync/storage'
import { isOAuthUser } from '@/features/onboarding/registration'
import { syncEngine } from '@/sync/syncEngine'
import { checkConnectivity, isOnline } from '@/sync/connectivity'
import { saveOfflineSnapshot } from '@/desktop/offlineAuth'
import {
  cacheProfile, cacheBusiness, getCachedProfile, getCachedBusiness,
  cacheOfflineUser, getCachedOfflineUser, clearCache,
  markBusinessVerified,
} from '@/lib/sessionCache'
import { toast } from 'sonner'
import packageJson from '../package.json'

// ── VERSIONING ──
const APP_VERSION = packageJson.version
const DESKTOP_SPLASH_MIN_MS = 1600

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const DesktopAuthPage = lazy(() => import('@/pages/auth/DesktopAuthPage'))
const MenuLauncher = lazy(() => import('@/pages/menu/MenuLauncher'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const POSPage = lazy(() => import('@/pages/pos/POSPage'))
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'))
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage'))
const CashRegisterPage = lazy(() => import('@/pages/cash-register/CashRegisterPage'))
const SalesHistoryPage = lazy(() => import('@/pages/sales/SalesHistoryPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const ProfitabilityPage = lazy(() => import('@/pages/reports/ProfitabilityPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const PurchasesPage = lazy(() => import('@/pages/purchases/PurchasesPage'))
const AccountingPage = lazy(() => import('@/pages/accounting/AccountingPage'))
const ComprobantesPage = lazy(() => import('@/pages/comprobantes/ComprobantesPage'))
const QuotesPage = lazy(() => import('@/pages/quotes/QuotesPage'))
const PromotionsPage = lazy(() => import('@/pages/promotions/PromotionsPage'))
const WarehousesPage = lazy(() => import('@/pages/warehouses/WarehousesPage'))
const CompleteRegistrationPage = lazy(() => import('@/pages/auth/CompleteRegistrationPage'))
const LocalesPage = lazy(() => import('@/pages/locales/LocalesPage'))
const HelpPage = lazy(() => import('@/pages/help/HelpPage'))
const LoyaltyPage = lazy(() => import('@/pages/loyalty/LoyaltyPage'))
const OnlineStorePage = lazy(() => import('@/pages/store/OnlineStorePage'))
const WhatsAppPage = lazy(() => import('@/pages/whatsapp/WhatsAppPage'))
const TiendanubePage = lazy(() => import('@/pages/tiendanube/TiendanubePage'))
const DownloadPage = lazy(() => import('@/pages/download/DownloadPage'))
const StorefrontPage = lazy(() => import('@/pages/store/StorefrontPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const LegalPage = lazy(() => import('@/pages/legal/LegalPage'))
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const SubscriptionBlockedPage = lazy(() => import('@/pages/subscription/SubscriptionBlockedPage'))
const SubscriptionReturnPage = lazy(() => import('@/pages/subscription/SubscriptionReturnPage'))
const ProductDetailPage = lazy(() => import('@/pages/products/ProductDetailPage'))

// New feature pages
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const HealthPage = lazy(() => import('@/features/health/HealthPage'))
const DailySummaryPage = lazy(() => import('@/features/daily_summary/DailySummaryPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const MusicPage = lazy(() => import('@/pages/music/MusicPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// Cuánto se "snoozea" el recordatorio de pago al cerrarlo con la X — vuelve a
// insistir pasado este tiempo en vez de desaparecer para el resto de la sesión.
const PAYMENT_REMINDER_SNOOZE_MS = 15 * 60 * 1000

/** CajaGo se usa solo como programa: en la web (salvo en desarrollo) el sistema lleva a descargarlo. */
/**
 * CajaGo se usa también desde el navegador (computadora, tablet y celular): la web ya no se bloquea.
 * El programa de escritorio sigue siendo la opción con funcionamiento sin internet reforzado.
 */
function webAppBlocked() {
  return false
}

function webLoginAllowed() {
  return true
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, needsOnboarding } = useAuthStore()
  const { business } = useBusinessStore()
  const [sessionClosed, setSessionClosed] = useState(false)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!(loading || (user && !profile))) {
      setStuck(false)
      return
    }
    const timer = setTimeout(() => setStuck(true), 15000)
    return () => clearTimeout(timer)
  }, [loading, user, profile])

  useEffect(() => {
    if (!sessionClosed) return
    const timer = setTimeout(() => setSessionClosed(false), PAYMENT_REMINDER_SNOOZE_MS)
    return () => clearTimeout(timer)
  }, [sessionClosed])


  useEffect(() => {
    try {
      console.log('[ProtectedRoute debug] business:', JSON.stringify(business))
      console.log('[ProtectedRoute debug] subscription_status:', business?.subscription_status)
      console.log('[ProtectedRoute debug] trial_ends_at:', business?.trial_ends_at)
      console.log('[ProtectedRoute debug] profile:', JSON.stringify(profile))
      console.log('[ProtectedRoute debug] sessionClosed:', sessionClosed)
      console.log('[ProtectedRoute debug] calculated daysLeft:', calculateRawRemainingDays(business?.trial_ends_at))
    } catch (e) {
      console.warn('[ProtectedRoute debug] error logging debug info', e)
    }
  }, [business, profile, sessionClosed])

  if (user && !profile && needsOnboarding) return <Navigate to="/completar-registro" replace />

  // Loading OR (user exists but profile hasn't loaded yet) → show spinner
  if (loading || (user && !profile)) {
    if (stuck) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <p className="text-muted-foreground text-sm">No pudimos cargar tu cuenta. Revisá tu conexión e intentá de nuevo.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
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

  const isSuperAdmin = profile?.is_superadmin

  // El superadmin entra directo al panel admin (solo la primera vez por sesión,
  // así después puede volver al menú normalmente).
  if (isSuperAdmin && window.location.pathname === '/menu') {
    let redirected = false
    try { redirected = !!sessionStorage.getItem('admin_redirected') } catch {}
    if (!redirected) {
      try { sessionStorage.setItem('admin_redirected', '1') } catch {}
      return <Navigate to="/admin" replace />
    }
  }

  const daysLeft = calculateRawRemainingDays(business?.trial_ends_at)

  // Recordatorio para negocios en trial o ya activos (mensualidad por vencer),
  // con pocos días restantes (excepto superadmin).
  // Incluye el día del vencimiento (daysLeft 0); una vez vencido lo maneja el modal de bloqueo.
  // Con débito automático de Mercado Pago no hay nada que pagar a mano.
  const shouldShowPaymentReminder = !isSuperAdmin &&
    business?.mp_subscription_status !== 'authorized' &&
    (business?.subscription_status === 'trial' || business?.subscription_status === 'active') &&
    !isSubscriptionExpired(business?.trial_ends_at) &&
    daysLeft <= 2 &&
    !sessionClosed

  if (shouldShowPaymentReminder) {
    return (
      <>
        {children}
        <PaymentNotificationModal
          daysLeft={daysLeft}
          onClose={() => setSessionClosed(true)}
        />
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

/** El QR de un producto abre CajaGo en ese producto (solo lo ve quien pertenece a ese negocio). */
function ProductLinkRedirect() {
  const { id } = useParams()
  return <Navigate to={`/products/${id ?? ''}`} replace />
}

function RootRoute() {
  const { user, loading, profile } = useAuthStore()
  const isDesktop = checkIsTauriDesktop()

  // En la aplicación Desktop (Tauri): ir directo a Login o al Menú principal, NUNCA a la landing comercial
  if (isDesktop) {
    if (loading) return <SplashScreen />
    if (user && profile) return <Navigate to="/menu" replace />
    return <DesktopAuthPage initialTab="login" />
  }

  // En la Web comercial pública: mostrar la Landing Page
  return <LandingPage />
}

export default function App() {
  const { setUser, setLoading, setProfile, profile: activeProfile } = useAuthStore()
  const { fetchBusiness, setBusiness } = useBusinessStore()
  const [showStartupSplash, setShowStartupSplash] = useState(() => checkIsTauriDesktop())

  useEffect(() => {
    if (!showStartupSplash) return
    const timer = window.setTimeout(() => setShowStartupSplash(false), DESKTOP_SPLASH_MIN_MS)
    return () => window.clearTimeout(timer)
  }, [showStartupSplash])

  useEffect(() => {
    if (!activeProfile?.business_id) return
    syncEngine.init().then(async () => {
      // Precarga instantánea en la PC + subida de cola pendiente y descarga de tablas en segundo plano.
      await syncEngine.preloadBusinessData(activeProfile.business_id)
    }, (error) => {
      // Solo un fallo al abrir la base es grave; la causa se muestra para poder diagnosticarlo.
      console.error('[Local DB] initialization failed:', error)
      toast.error(`No se pudo abrir la base local (${error?.message || error}). No registres ventas hasta reiniciar CajaGo.`, { duration: 15000 })
    }).catch((error) => {
      console.warn('[Local DB] initial download failed:', error)
    })
  }, [activeProfile?.business_id])

  // ── WEB SIEMPRE AL DÍA ──
  // Las actualizaciones con aviso son solo del programa (updater firmado). En la web, si se publicó
  // una versión nueva, se limpia la caché y se recarga una sola vez, sin preguntar nada.
  useEffect(() => {
    if (checkIsTauriDesktop()) return
    fetch('/version.json?t=' + Date.now())
      .then((res) => res.json())
      .then(async (data) => {
        if (!data?.version || data.version === APP_VERSION) return
        const reloadKey = `cajago_web_reloaded_${data.version}`
        if (sessionStorage.getItem(reloadKey)) return
        sessionStorage.setItem(reloadKey, '1')
        if ('caches' in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)))
        const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? []
        await Promise.all(registrations.map((registration) => registration.update().catch(() => {})))
        window.location.reload()
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // ── BULLETPROOF AUTH WITH LOCALSTORAGE CACHE ──
    // The Supabase free tier has server-side query timeouts.
    // After the first successful load, we cache profile+business in localStorage.
    // On subsequent visits / tab switches, we use the cache instantly.

    let profileLoaded = false
    let lastProfileError: string | null = null

    function applyProfile(data: any) {
      const profile = {
        id: data.id,
        business_id: data.business_id,
        name: data.name,
        email: data.email,
        role: data.role as 'admin' | 'seller' | 'seller_jr',
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
          console.warn('[Auth] no se pudo leer el perfil:', error?.message ?? 'sin fila para este usuario')
          lastProfileError = error?.message ?? 'No encontramos tu perfil de usuario.'
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
          markBusinessVerified()
          resetTrustedClock()
        }

        // Datos para poder volver a ingresar en este equipo aunque no haya Internet.
        const cachedUser = getCachedOfflineUser()
        if (checkIsTauriDesktop() && cachedUser?.id === userId) {
          saveOfflineSnapshot(userId, { user: cachedUser, profile, business: biz || null }).catch(() => {})
        }

        profileLoaded = true
        console.log('[Auth] loaded from network OK')
        return true
      } catch (e: any) {
        console.warn('[Auth] error de red al leer el perfil:', e?.message)
        lastProfileError = e?.message || 'No pudimos conectarnos para cargar tu cuenta.'
        return false
      }
    }

    function loadFromCache(userId: string): boolean {
      const cached = getCachedProfile()
      const cachedBiz = getCachedBusiness()
      console.log('[Auth] loadFromCache cachedBiz:', cachedBiz)
      if (cached && cached.id === userId) {
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
        // Sin sesión y sin servidor (sin Internet o Supabase caído): el último usuario
        // de este equipo sigue trabajando con los datos locales.
        if (!(await checkConnectivity())) {
          const cachedUser = getCachedOfflineUser()
          if (cachedUser && loadFromCache(cachedUser.id)) {
            setUser(cachedUser)
            setLoading(false)
            return
          }
        }
        setLoading(false)
        return
      }

      setUser(session.user)
      cacheOfflineUser(session.user)

      // Try cache first (instant)
      if (loadFromCache(session.user.id)) {
        setLoading(false)
        // Refresh from network in background (silent)
        loadFromNetwork(session.user.id)
        return
      }

      // No cache → must load from network (with retries)
      let loaded = false
      for (let i = 1; i <= 3; i++) {
        loaded = await loadFromNetwork(session.user.id)
        if (loaded) break
        if (i < 3) await new Promise(r => setTimeout(r, i * 2000))
      }

      // Si la red no respondió a tiempo, recurrimos al caché local para evitar cerrar la sesión
      if (!loaded) {
        console.warn('[Auth] no se pudo cargar el perfil desde la red en este intento')
        const cached = getCachedProfile()
        if (cached && cached.id === session.user.id) {
          setProfile(cached)
          const cachedBiz = getCachedBusiness()
          if (cachedBiz) setBusiness(cachedBiz)
        } else if (lastProfileError?.includes('sin fila para este usuario')) {
          if (isOAuthUser(session.user)) {
            // Entró con Google por primera vez: falta crear su negocio.
            useAuthStore.getState().setNeedsOnboarding(true)
          } else {
            // Solo cerramos sesión si expresamente el usuario no existe en la base de datos
            try { sessionStorage.setItem('stockia_login_error', lastProfileError || '') } catch {}
            await supabase.auth.signOut()
            setUser(null)
          }
        }
      }
      setLoading(false)
    }).catch(() => {
      const cachedUser = getCachedOfflineUser()
      if (cachedUser && loadFromCache(cachedUser.id)) setUser(cachedUser)
      setLoading(false)
    })

    // ── Step 2: auth state changes ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Un cierre de sesión pedido por el usuario borra antes el usuario offline,
        // así que esto solo restaura cuando la sesión se cayó por falta de conexión.
        if (!isOnline()) {
          const cachedUser = getCachedOfflineUser()
          if (cachedUser && loadFromCache(cachedUser.id)) {
            setUser(cachedUser)
            setLoading(false)
            return
          }
        }
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
      cacheOfflineUser(session.user)

      // Already loaded → just sync token, done
      if (profileLoaded) {
        setLoading(false)
        return
      }

      // New sign-in → try cache, then network
      if (event === 'SIGNED_IN') {
        if (loadFromCache(session.user.id)) {
          setLoading(false)
          loadFromNetwork(session.user.id) // silent refresh
          return
        }

        setLoading(true)
        let loaded = false
        for (let i = 1; i <= 3; i++) {
          loaded = await loadFromNetwork(session.user.id)
          if (loaded) break
          if (i < 3) await new Promise(r => setTimeout(r, i * 2000))
        }
        if (!loaded) {
          console.warn('[Auth] no se pudo cargar el perfil tras iniciar sesión')
          const cached = getCachedProfile()
          if (cached && cached.id === session.user.id) {
            setProfile(cached)
            const cachedBiz = getCachedBusiness()
            if (cachedBiz) setBusiness(cachedBiz)
          } else if (lastProfileError?.includes('sin fila para este usuario')) {
            if (isOAuthUser(session.user)) {
              useAuthStore.getState().setNeedsOnboarding(true)
            } else {
              try { sessionStorage.setItem('stockia_login_error', lastProfileError || '') } catch {}
              await supabase.auth.signOut()
              setUser(null)
            }
          }
        }
        setLoading(false)
      }
    })

    return () => { subscription.unsubscribe() }
  }, [])

  if (showStartupSplash) return <SplashScreen />

  return (
    <Suspense fallback={<SplashScreen />}>
      <ScrollToTop />
      <Routes>
        {/* Public */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/index.html" element={<RootRoute />} />
        <Route
          path="/landing"
          element={
            checkIsTauriDesktop() ? (
              <Navigate to="/login" replace />
            ) : (
              <LandingPage />
            )
          }
        />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="/login"
          element={
            checkIsTauriDesktop() ? (
              <DesktopAuthPage initialTab="login" />
            ) : webAppBlocked() && !webLoginAllowed() ? (
              <Navigate to="/descargar" replace />
            ) : (
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            )
          }
        />
        <Route
          path="/register"
          element={
            checkIsTauriDesktop() ? (
              <DesktopAuthPage initialTab="register" />
            ) : webAppBlocked() ? (
              <Navigate to="/descargar" replace />
            ) : (
              <RegisterPage />
            )
          }
        />
        <Route path="/completar-registro" element={<CompleteRegistrationPage />} />
        <Route path="/p/:id" element={<ProtectedRoute><ProductLinkRedirect /></ProtectedRoute>} />
        <Route path="/subscription-blocked" element={<SubscriptionBlockedPage />} />
        <Route path="/suscripcion/listo" element={<SubscriptionReturnPage />} />
        <Route path="/tienda/:slug" element={<StorefrontPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/descargar" element={<DownloadPage />} />
        <Route path="/terminos" element={<LegalPage kind="terms" />} />
        <Route path="/privacidad" element={<LegalPage kind="privacy" />} />

        {/* Protected — app shell launcher (no sidebar) */}
        <Route path="/" element={webAppBlocked() ? <Navigate to="/descargar" replace /> : <ProtectedRoute><AppShellLauncher /></ProtectedRoute>}>
          <Route path="menu" element={<MenuLauncher />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<SubscriptionGuard mode="block"><POSPage /></SubscriptionGuard>} />
          <Route path="products" element={<SubscriptionGuard mode="block"><ProductsPage /></SubscriptionGuard>} />
          <Route path="products/:id" element={<SubscriptionGuard mode="block"><ProductDetailPage /></SubscriptionGuard>} />
          <Route path="purchases" element={<SubscriptionGuard mode="block"><PlanGate feature="purchases"><PermissionGuard permission="purchases.read"><PurchasesPage /></PermissionGuard></PlanGate></SubscriptionGuard>} />
          <Route path="accounting" element={<SubscriptionGuard mode="block"><PlanGate feature="accounting"><PermissionGuard permission="accounting.read"><AccountingPage /></PermissionGuard></PlanGate></SubscriptionGuard>} />
          <Route path="comprobantes" element={<SubscriptionGuard mode="block"><ComprobantesPage /></SubscriptionGuard>} />
          <Route path="presupuestos" element={<SubscriptionGuard mode="block"><PlanGate feature="quotes"><QuotesPage /></PlanGate></SubscriptionGuard>} />
          <Route path="ayuda" element={<HelpPage />} />
          <Route path="locales" element={<SubscriptionGuard mode="block"><PlanGate feature="locales"><LocalesPage /></PlanGate></SubscriptionGuard>} />
          <Route path="depositos" element={<SubscriptionGuard mode="block"><PlanGate feature="warehouses"><WarehousesPage /></PlanGate></SubscriptionGuard>} />
          <Route path="promociones" element={<SubscriptionGuard mode="block"><PlanGate feature="promotions"><PromotionsPage /></PlanGate></SubscriptionGuard>} />
          <Route path="club" element={<SubscriptionGuard mode="block"><PlanGate feature="loyalty"><LoyaltyPage /></PlanGate></SubscriptionGuard>} />
          <Route path="tienda" element={<SubscriptionGuard mode="block"><PlanGate feature="online_store"><OnlineStorePage /></PlanGate></SubscriptionGuard>} />
          <Route path="whatsapp" element={<SubscriptionGuard mode="block"><PlanGate feature="whatsapp_ai"><WhatsAppPage /></PlanGate></SubscriptionGuard>} />
          <Route path="tiendanube" element={<SubscriptionGuard mode="block"><PlanGate feature="tiendanube"><TiendanubePage /></PlanGate></SubscriptionGuard>} />
          <Route path="customers" element={<SubscriptionGuard mode="block"><CustomersPage /></SubscriptionGuard>} />
          <Route path="cash-register" element={<SubscriptionGuard mode="block"><CashRegisterPage /></SubscriptionGuard>} />
          <Route path="sales" element={<SubscriptionGuard mode="block"><SalesHistoryPage /></SubscriptionGuard>} />
          <Route path="reports" element={<SubscriptionGuard mode="block"><ReportsPage /></SubscriptionGuard>} />
          <Route path="rentabilidad" element={<SubscriptionGuard mode="block"><PlanGate feature="profitability"><ProfitabilityPage /></PlanGate></SubscriptionGuard>} />
          <Route path="reports/rentabilidad" element={<SubscriptionGuard mode="block"><PlanGate feature="profitability"><ProfitabilityPage /></PlanGate></SubscriptionGuard>} />
          <Route path="daily-summary" element={<SubscriptionGuard mode="block"><PlanGate feature="daily_summary"><DailySummaryPage /></PlanGate></SubscriptionGuard>} />
          <Route path="settings" element={<SettingsPage />} />
          {/* New feature routes */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="music" element={<MusicPage />} />
        </Route>

        <Route
          path="*"
          element={
            checkIsTauriDesktop() ? (
              <RootRoute />
            ) : (
              <NotFoundPage />
            )
          }
        />
      </Routes>
      {checkIsTauriDesktop() && (
        <div className="fixed bottom-2 right-3 z-50 text-[10px] font-bold text-white/10 uppercase tracking-[0.3em] pointer-events-none">
          v{APP_VERSION}
        </div>
      )}
      <SupportWhatsAppButton />
      <UpdateModal />
      <MusicDownloadPrompt />
      <CashAutoCloser />
      <ManagerPinModal />
    </Suspense>
  )
}

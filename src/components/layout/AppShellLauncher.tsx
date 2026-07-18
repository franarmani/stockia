import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useHotkeys } from '@/hooks/useHotkeys'
import {
  WifiOff, RefreshCw, Loader2, LogOut, LayoutDashboard,
  ShoppingCart, Package, Truck, Users, FileText, Wallet,
  Receipt, BarChart3, Settings, Bell, Menu, X, ChevronLeft, ChevronRight,
  Music, Activity, CalendarDays,
} from 'lucide-react'
import logoSolo from '@/logosolo.png'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { useMusicStore } from '@/stores/useMusicStore'
import { useSubscription } from '@/features/subscription'
import MiniPlayer from './MiniPlayer'
import YouTubePlayer from '@/components/music/YouTubePlayer'
import SubscriptionBadge from '@/features/subscription/components/SubscriptionBadge'
import SubscriptionBanner from '@/features/subscription/components/SubscriptionBanner'
import TrialExpiredModal from '@/components/TrialExpiredModal'

const NAV_SECTIONS = [
  {
    label: 'Operación',
    items: [
      { name: 'Inicio', href: '/menu', icon: LayoutDashboard },
      { name: 'Nueva venta', href: '/pos', icon: ShoppingCart },
      { name: 'Historial', href: '/sales', icon: Receipt },
      { name: 'Caja', href: '/cash-register', icon: Wallet },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Compras', href: '/purchases', icon: Truck },
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Comprobantes', href: '/comprobantes', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { name: 'Notificaciones', href: '/notifications', icon: Bell },
      { name: 'Resúmenes', href: '/daily-summary', icon: CalendarDays },
      { name: 'Música', href: '/music', icon: Music },
      { name: 'Configuración', href: '/settings', icon: Settings },
    ],
  },
]

const SIDEBAR_KEY = 'stockia_sidebar_collapsed'

export default function AppShellLauncher() {
  useHotkeys()

  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuthStore()
  const { business } = useBusinessStore()
  const { isOnline, pendingCount, syncing, syncPendingSales } = useOnlineStatus()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { 
      const stored = localStorage.getItem(SIDEBAR_KEY)
      return stored !== null ? stored === 'true' : true 
    } catch { return true }
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const { initAudio } = useMusicStore()
  const { isExpired, status } = useSubscription()

  // El día que vence, se avisa con el banner de /menu (con cronómetro) en vez de
  // bloquear de entrada — recién se bloquea cuando el día completo ya pasó.
  const shouldShowBlockingModal = isExpired || business?.subscription_status === 'expired'

  useEffect(() => {
    try {
      console.log('[AppShellLauncher debug] business:', business)
      console.log('[AppShellLauncher debug] subscription status:', status)
      console.log('[AppShellLauncher debug] isExpired:', isExpired)
      console.log('[AppShellLauncher debug] trial_ends_at:', business?.trial_ends_at)
      console.log('[AppShellLauncher debug] shouldShowBlockingModal:', shouldShowBlockingModal)
    } catch (e) {
      console.warn('[AppShellLauncher debug] error logging debug info', e)
    }
  }, [business, status, isExpired, shouldShowBlockingModal])

  useEffect(() => { initAudio() }, [])

  const isPOS = location.pathname === '/pos'

  const handleToggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch {}
      return next
    })
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (href: string) => {
    if (href === '/menu') return location.pathname === '/menu'
    return location.pathname.startsWith(href)
  }

  const renderSidebar = (sidebarCollapsed: boolean, onCloseButton?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-[72px] px-4 border-b border-white/10 shrink-0',
        sidebarCollapsed ? 'justify-center' : 'justify-between gap-3'
      )}>
        <div className={cn('flex items-center gap-3 min-w-0', sidebarCollapsed ? 'justify-center' : '')}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/95 shadow-[0_0_12px_rgba(255,255,255,0.2)] shrink-0">
            <img src="/og-image.png" alt="Icono" className="h-5 w-auto object-contain" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden flex flex-col items-start gap-1 mt-1">
              <img src="/2.png" alt="STOCKIA" className="h-3.5 w-auto brightness-0 invert" />
            </div>
          )}
        </div>
        {onCloseButton && (
          <button
            onClick={onCloseButton}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 shrink-0"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>


      {/* Navigation */}
      <nav key={sidebarCollapsed ? 'collapsed' : 'expanded'} className="flex-1 py-3 space-y-1 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!sidebarCollapsed ? (
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-5 mb-2 h-3 flex items-center">
                {section.label}
              </p>
            ) : (
              <div className="h-3 mb-2 flex items-center justify-center">
                <span className="w-4 h-px bg-white/15 rounded-full" />
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, i) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  title={sidebarCollapsed ? item.name : undefined}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2.5 mx-3 rounded-xl text-[13px] font-medium transition-all duration-300 group',
                    sidebarCollapsed ? 'justify-center' : '',
                    isActive(item.href)
                      ? 'border-l-[3px] border-primary text-primary bg-gradient-to-r from-primary/15 to-transparent shadow-[inset_1px_0_10px_rgba(0,240,255,0.1)]'
                      : 'border-l-[3px] border-transparent text-white/40 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className={cn(
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    isActive(item.href) ? 'text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'text-white/30 group-hover:text-white/60'
                  )} />
                  {!sidebarCollapsed && (
                    <span className={cn("truncate flex-1", isActive(item.href) && "drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]")}>{item.name}</span>
                  )}

                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 shrink-0 space-y-2">
        {!sidebarCollapsed && profile && (
          <div className="px-3 py-2 text-left">
            <p className="text-[12px] font-medium text-white truncate">{profile.name}</p>
            <p className="text-[10px] text-white/30 truncate">{profile.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all',
            sidebarCollapsed ? 'justify-center' : ''
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0 text-white/30" />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  // POS gets full-bleed layout
  if (isPOS) {
    return (
      <div className="app-bg dark-shell min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
        <MiniPlayer />
        <YouTubePlayer />
        {isExpired && <TrialExpiredModal />}
      </div>
    )
  }

  return (
    <div className="app-bg dark-shell min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-300 ease-in-out bg-surface/80 backdrop-blur-3xl border-r border-white/10 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.5)] text-white',
          sidebarCollapsed && !sidebarHovered ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        {renderSidebar(sidebarCollapsed && !sidebarHovered)}
      </aside>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-surface/90 backdrop-blur-3xl border-r border-white/10 shadow-2xl animate-slide-in-left overflow-x-hidden text-white">
            {renderSidebar(false, () => setMobileDrawerOpen(false))}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-sidebar/85 backdrop-blur-xl shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
              <span className="font-bold text-white text-[12px] uppercase tracking-widest truncate max-w-[160px]">{business?.name || 'STOCKIA HUB'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Offline */}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-[10px] font-bold">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Sin conexión</span>
              </div>
            )}
            {/* Sync */}
            {isOnline && pendingCount > 0 && (
              <button
                onClick={!syncing ? syncPendingSales : undefined}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary text-[10px] font-bold hover:bg-secondary/20"
              >
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>{syncing ? 'Sincronizando' : `${pendingCount}`}</span>
              </button>
            )}
            <SubscriptionBadge className="hidden md:flex" />
            <button
              onClick={() => navigate('/pos')}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Nueva venta
            </button>
          </div>
        </header>

        {/* Subscription banner */}
        <div className="px-4 md:px-6 pt-3 max-w-[1600px] mx-auto w-full">
          <SubscriptionBanner />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 md:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full pb-24 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      <MiniPlayer />
      <YouTubePlayer />
      {shouldShowBlockingModal && <TrialExpiredModal />}
    </div>
  )
}

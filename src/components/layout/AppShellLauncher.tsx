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
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
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
        'flex items-center h-16 px-4 border-b border-white/10 shrink-0',
        sidebarCollapsed ? 'justify-center' : 'justify-between gap-3'
      )}>
        <div className={cn('flex items-center gap-3 min-w-0', sidebarCollapsed ? 'justify-center' : '')}>
          <img src={logoSolo} alt="STOCKIA HUB" className="w-8 h-8 shrink-0" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-none tracking-tight">STOCKIA HUB</p>
              {business?.name && (
                <p className="text-[11px] text-white/40 truncate mt-0.5 max-w-[160px]">{business.name}</p>
              )}
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
      <div className="p-2 border-b border-white/10 shrink-0 hidden lg:flex">
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleCollapse() }}
          className="w-full flex items-center justify-center p-2 rounded-xl text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav key={sidebarCollapsed ? 'collapsed' : 'expanded'} className="flex-1 px-2 py-2 space-y-2.5 overflow-y-auto overflow-x-hidden">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed ? (
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest px-3 mb-1.5 h-3 flex items-center">
                {section.label}
              </p>
            ) : (
              <div className="h-3 mb-1.5 flex items-center justify-center">
                <span className="w-5 h-px bg-white/15 rounded-full" />
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
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all group animate-pop-3d',
                    sidebarCollapsed ? 'justify-center' : '',
                    isActive(item.href)
                      ? 'bg-primary/15 text-primary'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className={cn(
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    isActive(item.href) ? 'text-primary' : 'text-white/30 group-hover:text-white/60'
                  )} />
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 animate-fade-in">{item.name}</span>
                  )}
                  {!sidebarCollapsed && isActive(item.href) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}

                  {/* Floating 3D glassmorphism icon preview on hover (icon only, no text) — desktop only, it's what causes horizontal overflow on the mobile drawer */}
                  <span
                    aria-hidden
                    className="pointer-events-none hidden lg:flex absolute left-[calc(100%+26px)] top-1/2 z-[9999]
                      items-center justify-center w-[76px] h-[76px] rounded-[22px]
                      bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.24),transparent_45%),linear-gradient(145deg,rgba(12,45,30,0.92),rgba(3,18,12,0.96))]
                      border border-[rgba(34,197,94,0.38)] backdrop-blur-[16px]
                      shadow-[0_22px_45px_rgba(0,0,0,0.48),0_0_30px_rgba(34,197,94,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
                      opacity-0 [transform:translateY(-50%)_perspective(900px)_translateX(-8px)_rotateY(-22deg)_scale(0.72)]
                      transition-[opacity,transform] duration-200 ease-out
                      group-hover:opacity-100 group-hover:[transform:translateY(-50%)_perspective(900px)_translateX(0)_rotateY(0deg)_scale(1)]"
                  >
                    <item.icon className="w-[38px] h-[38px] text-primary drop-shadow-[0_0_12px_rgba(34,197,94,0.45)]" />
                  </span>
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
        <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 bg-sidebar border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/menu')} className="flex items-center gap-2">
              <img src={logoSolo} alt="STOCKIA HUB" className="w-7 h-7" />
            </button>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Nueva venta</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <SubscriptionBadge />
            <button
              onClick={() => navigate('/menu')}
              className="text-xs text-white/40 hover:text-white px-2 py-1"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 pt-14 flex flex-col">
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
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-300 ease-in-out bg-sidebar border-r border-border z-30',
          sidebarCollapsed && !sidebarHovered ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        {renderSidebar(sidebarCollapsed && !sidebarHovered)}
      </aside>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-sidebar border-r border-border shadow-2xl animate-slide-in-left overflow-x-hidden">
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
            <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-white truncate max-w-[160px]">{business?.name || 'STOCKIA HUB'}</span>
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

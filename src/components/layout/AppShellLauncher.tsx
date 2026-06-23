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
  const { initAudio } = useMusicStore()
  const { expiresToday, isExpired, status } = useSubscription()

  // Force modal if trial_ends_at is in the past, even if status says "active"
  const isTrialEndedPast = business?.trial_ends_at ? 
    new Date(business.trial_ends_at).getTime() < new Date().getTime() : false
  const shouldShowBlockingModal = expiresToday || isExpired || business?.subscription_status === 'expired' || isTrialEndedPast

  useEffect(() => {
    try {
      console.log('[AppShellLauncher debug] business:', business)
      console.log('[AppShellLauncher debug] subscription status:', status)
      console.log('[AppShellLauncher debug] expiresToday:', expiresToday, 'isExpired:', isExpired)
      console.log('[AppShellLauncher debug] trial_ends_at:', business?.trial_ends_at)
      console.log('[AppShellLauncher debug] isTrialEndedPast:', isTrialEndedPast)
      console.log('[AppShellLauncher debug] shouldShowBlockingModal:', shouldShowBlockingModal)
    } catch (e) {
      console.warn('[AppShellLauncher debug] error logging debug info', e)
    }
  }, [business, status, expiresToday, isExpired, isTrialEndedPast, shouldShowBlockingModal])

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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-white/5 shrink-0',
        sidebarCollapsed ? 'justify-center' : 'gap-3'
      )}>
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
      <div className="p-2 border-b border-white/5 shrink-0 hidden lg:flex">
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleCollapse() }}
          className="w-full flex items-center justify-center p-2 rounded-xl text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-3 mb-1.5">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group',
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
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                  {!sidebarCollapsed && isActive(item.href) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3 shrink-0 space-y-2">
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
        <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 bg-[#07111f] border-b border-white/5">
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
        {(expiresToday || isExpired) && <TrialExpiredModal />}
      </div>
    )
  }

  return (
    <div className="app-bg dark-shell min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200 bg-[#091525] border-r border-white/5 z-30',
          sidebarCollapsed ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-[#091525] border-r border-white/5 shadow-2xl animate-slide-in-left">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/5 bg-[#07111f]/80 backdrop-blur-xl shrink-0 sticky top-0 z-20">
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
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Sin conexión</span>
              </div>
            )}
            {/* Sync */}
            {isOnline && pendingCount > 0 && (
              <button
                onClick={!syncing ? syncPendingSales : undefined}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20"
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
        <main className="flex-1 overflow-auto">
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

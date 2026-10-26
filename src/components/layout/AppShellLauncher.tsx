import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom'
import OfflineIndicator from '@/components/OfflineIndicator'
import { usePlan } from '@/hooks/usePlan'
import { PLANS, type PlanId } from '@/config/plans'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useHotkeys } from '@/hooks/useHotkeys'
import {
  LogOut, LayoutDashboard,
  ShoppingCart, Package, Truck, Scale, Users, FileText, Wallet,
  Receipt, BarChart3, Settings, Menu, X, ChevronLeft, ChevronRight,
  Music, CalendarDays, ClipboardList, TrendingUp, Sparkles, Store, ChevronDown, User, Tag, Crown, Gift, Globe, MessageCircle, ShoppingBag
} from 'lucide-react'
import CajaGoBrand, { CajaGoIcon } from '@/components/brand/CajaGoBrand'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { useMusicStore } from '@/stores/useMusicStore'
import { useSubscription } from '@/features/subscription'
import MiniPlayer from './MiniPlayer'
import YouTubePlayer from '@/components/music/YouTubePlayer'
import SubscriptionBadge from '@/features/subscription/components/SubscriptionBadge'
import SubscriptionBanner from '@/features/subscription/components/SubscriptionBanner'
import NotificationBell from '@/features/notifications/NotificationBell'
import NotificationToastBridge from '@/features/notifications/NotificationToastBridge'
import TrialExpiredModal from '@/components/TrialExpiredModal'

const NAV_SECTIONS = [
  {
    label: 'Día a día',
    items: [
      { name: 'Inicio', href: '/menu', icon: LayoutDashboard },
      { name: 'Historial de ventas', href: '/sales', icon: Receipt },
      { name: 'Caja', href: '/cash-register', icon: Wallet },
    ],
  },
  {
    label: 'Mercadería',
    items: [
      { name: 'Productos y stock', href: '/products', icon: Package },
      { name: 'Compras', href: '/purchases', icon: Truck, plan: 'premium' as const },
      { name: 'Promociones', href: '/promociones', icon: Tag, plan: 'premium' as const },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Presupuestos', href: '/presupuestos', icon: ClipboardList, plan: 'premium' as const },
      { name: 'Club de puntos', href: '/club', icon: Gift, plan: 'premium' as const },
    ],
  },
  {
    label: 'Números',
    items: [
      { name: 'Comprobantes AFIP', href: '/comprobantes', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart3 },
      { name: 'Rentabilidad', href: '/rentabilidad', icon: TrendingUp, plan: 'premium' as const },
      { name: 'Contabilidad', href: '/accounting', icon: Scale, plan: 'vip' as const },
    ],
  },
  {
    label: 'Vender más',
    items: [
      { name: 'Tienda online', href: '/tienda', icon: Globe, plan: 'vip' as const },
      { name: 'Tiendanube', href: '/tiendanube', icon: ShoppingBag, plan: 'vip' as const },
      { name: 'WhatsApp IA', href: '/whatsapp', icon: MessageCircle, plan: 'vip' as const },
      { name: 'CajaGo Music', href: '/music', icon: Music, plan: 'premium' as const },
    ],
  },
]

export default function AppShellLauncher() {
  useHotkeys()

  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuthStore()
  const { business } = useBusinessStore()
  const { hasPlan } = usePlan()

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const { initAudio } = useMusicStore()
  const { isExpired, status, bannerState } = useSubscription()

  const shouldShowBlockingModal = isExpired || business?.subscription_status === 'expired'

  useEffect(() => { initAudio() }, [])

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1440px)')
    const closeDrawer = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileDrawerOpen(false)
    }

    mediaQuery.addEventListener('change', closeDrawer)
    return () => mediaQuery.removeEventListener('change', closeDrawer)
  }, [])

  const isPOS = location.pathname === '/pos'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (href: string) => {
    if (href === '/menu') return location.pathname === '/menu'
    return location.pathname.startsWith(href)
  }

  const navItemClass = (active: boolean) => cn(
    'group relative flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] transition-colors duration-150',
    active ? 'bg-white/[0.07] text-white font-semibold' : 'text-[#9CA6BA] font-medium hover:text-white hover:bg-white/[0.035]'
  )

  const renderSidebar = (onCloseButton?: () => void) => (
    <div className="flex flex-col h-full text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center justify-between h-16 px-5 shrink-0">
        <CajaGoBrand size="md" />
        {onCloseButton && (
          <button
            onClick={onCloseButton}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA6BA] hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Acción principal */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={() => { onCloseButton?.(); navigate('/pos') }}
          className="cg-btn-primary w-full h-10 px-3.5 rounded-lg text-[13px] justify-between"
        >
          <span className="flex items-center gap-2.5"><ShoppingCart className="w-4 h-4" /> Nueva venta</span>
          <kbd className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-white/15">F1</kbd>
        </button>
      </div>

      {/* Secciones */}
      <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto custom-scrollbar">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[12px] font-medium text-white/35">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <NavLink key={item.href} to={item.href} onClick={() => onCloseButton?.()} className={navItemClass(active)}>
                    {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#9aa9ff]" />}
                    <item.icon className={cn('w-4 h-4 shrink-0 transition-colors', active ? 'text-[#9aa9ff]' : 'text-white/40 group-hover:text-white/80')} />
                    <span className="truncate">{item.name}</span>
                    {(item as { upcoming?: boolean }).upcoming && (
                      <span className="ml-auto rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                        Próximo
                      </span>
                    )}
                    {(() => {
                      const required = (item as { plan?: PlanId }).plan
                      if (!required || (item as { upcoming?: boolean }).upcoming || hasPlan(required)) return null
                      return (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" aria-label={`Plan ${PLANS[required].name}`}>
                          <Crown className="w-2.5 h-2.5" /> {PLANS[required].name}
                        </span>
                      )
                    })()}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie */}
      <div className="px-3 py-3 shrink-0 border-t border-white/[0.06]">
        <NavLink to="/settings" onClick={() => onCloseButton?.()} className={navItemClass(isActive('/settings'))}>
          <Settings className={cn('w-4 h-4 shrink-0', isActive('/settings') ? 'text-[#9aa9ff]' : 'text-white/40 group-hover:text-white/80')} />
          <span className="truncate">Configuración</span>
        </NavLink>
      </div>
    </div>
  )

  // Full-bleed layout for POS
  if (isPOS) {
    return (
      <div className="app-shell dark-shell bg-background text-foreground min-h-screen flex flex-col">
        <NotificationToastBridge />
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
    <div className="app-shell dark-shell bg-background text-foreground min-h-screen flex overflow-x-clip">
      <NotificationToastBridge />
      {/* Desktop Sidebar (Permanent, solid, non-collapsing) */}
      <aside className="hidden min-[1440px]:flex flex-col h-screen sticky top-0 shrink-0 w-[248px] bg-[#080b10]/90 backdrop-blur-xl border-r border-white/[0.06] z-30 shadow-[8px_0_32px_rgba(2,5,10,0.16)]">
        {renderSidebar()}
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] min-[1440px]:hidden">
          <div
            className="absolute inset-0 bg-[#010211]/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#080b10] border-r border-white/[0.08] shadow-2xl animate-slide-in-left overflow-x-hidden">
            {renderSidebar(() => setMobileDrawerOpen(false))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="app-topbar h-14 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 border-b border-white/[0.07] bg-[#090c11]/75 backdrop-blur-xl shrink-0 sticky top-0 z-20 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="min-[1440px]:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] shrink-0"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="hidden sm:inline text-[13px] font-medium text-white/50 truncate shrink-0">
                {location.pathname.startsWith('/settings')
                  ? 'Configuración'
                  : NAV_SECTIONS.flatMap(section => section.items).find(item => isActive(item.href))?.name ?? location.pathname.slice(1).replace('-', ' ')}
              </span>
              <span className="hidden sm:inline text-white/20 shrink-0">/</span>
              <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-[90px] min-[440px]:max-w-[150px] sm:max-w-[240px] md:max-w-[320px]">
                {business?.name || 'CajaGo'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Conexión, operaciones pendientes y conflictos */}
            <OfflineIndicator />

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile & Settings Menu Dropdown */}
            <div className="relative shrink-0" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(v => !v)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 transition-all group shrink-0"
                aria-label="Perfil y configuración"
                title="Perfil y configuración"
              >
                <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[100px] 2xl:max-w-[140px]">
                    {profile?.name || 'Mi Perfil'}
                  </span>
                  <span className="text-[9px] text-white/40 leading-none mt-0.5 font-medium">Configuración</span>
                </div>
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 text-white/40 group-hover:text-white transition-transform duration-200 hidden sm:block',
                  profileMenuOpen && 'rotate-180 text-white'
                )} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-12 w-[min(18rem,calc(100vw-1rem))] bg-surface-elevated border border-white/10 shadow-[0_24px_72px_rgba(2,5,10,0.52)] rounded-[14px] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Header */}
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-[10px] bg-primary text-white font-bold text-sm flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{profile?.name || 'Usuario'}</p>
                        <p className="text-[11px] text-white/50 truncate">{profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/[0.06] text-[11px] text-white/60">
                      <Store className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate font-medium">{business?.name || 'Mi Comercio'}</span>
                      {(business as any)?.city && (
                        <span className="text-white/40 text-[10px] truncate">({(business as any).city})</span>
                      )}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="space-y-1">
                    <button
                      onClick={() => { navigate('/settings'); setProfileMenuOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/[0.06] transition-colors text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block font-semibold">Configuración General</span>
                        <span className="block text-[10px] text-white/40">Datos del negocio, clima y AFIP</span>
                      </div>
                    </button>

                    <button
                      onClick={() => { navigate('/daily-summary'); setProfileMenuOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/[0.06] transition-colors text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                        <CalendarDays className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block font-semibold">Resumen Diario</span>
                        <span className="block text-[10px] text-white/40">Métricas y balance del día</span>
                      </div>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-2 mt-2 border-t border-white/[0.08]">
                    <button
                      onClick={() => { setProfileMenuOpen(false); handleSignOut() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Subscription Banner (Only shown if critical or urgent) */}
        {bannerState && (
          <div className="px-3 sm:px-4 md:px-6 pt-3 max-w-[1600px] mx-auto w-full min-w-0">
            <SubscriptionBanner />
          </div>
        )}

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="app-content px-3 sm:px-4 md:px-6 min-[1440px]:px-8 py-4 sm:py-6 max-w-[1600px] mx-auto w-full pb-24 lg:pb-8 min-w-0">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Ultra convenient for Web & Mobile App) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-xl border-t border-white/[0.08] flex items-center justify-around px-2 z-40">
          <NavLink
            to="/menu"
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors',
              isActive ? 'text-[#9aa9ff] font-bold' : 'text-[#9CA6BA]'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Inicio</span>
          </NavLink>

          <NavLink
            to="/sales"
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors',
              isActive ? 'text-[#9aa9ff] font-bold' : 'text-[#9CA6BA]'
            )}
          >
            <Receipt className="w-4 h-4" />
            <span>Ventas</span>
          </NavLink>

          {/* Floating POS Center Button */}
          <button
            onClick={() => navigate('/pos')}
            className="-mt-5 w-12 h-12 rounded-[14px] bg-primary text-white flex items-center justify-center transition-all active:translate-y-px"
            aria-label="Punto de Venta"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>

          <NavLink
            to="/products"
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors',
              isActive ? 'text-[#9aa9ff] font-bold' : 'text-[#9CA6BA]'
            )}
          >
            <Package className="w-4 h-4" />
            <span>Stock</span>
          </NavLink>

          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium text-[#9CA6BA] hover:text-[#FCFCFD]"
          >
            <Menu className="w-4 h-4" />
            <span>Menú</span>
          </button>
        </nav>
      </div>

      <MiniPlayer />
      <YouTubePlayer />
      {shouldShowBlockingModal && <TrialExpiredModal />}
    </div>
  )
}

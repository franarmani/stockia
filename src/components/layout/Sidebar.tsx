import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import logoSolo from '@/logosolo.png'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  Wallet,
  Receipt,
  Truck,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Shield,
  Music
} from 'lucide-react'
import { calculateRemainingDays } from '@/lib/subscription'

const NAV_ITEMS = [
  { name: 'Inicio',         href: '/dashboard',    icon: LayoutDashboard },
  { name: 'Punto de venta', href: '/pos',           icon: ShoppingCart },
  { name: 'Productos',      href: '/products',      icon: Package },
  { name: 'Compras',        href: '/purchases',     icon: Truck },
  { name: 'Clientes',       href: '/customers',     icon: Users },
  { name: 'Comprobantes',   href: '/comprobantes',  icon: FileText },
  { name: 'Caja',           href: '/cash-register', icon: Wallet },
  { name: 'Historial',      href: '/sales',         icon: Receipt },
  { name: 'Reportes',       href: '/reports',       icon: BarChart3 },
  { name: 'Música',          href: '/music',         icon: Music, premium: true },
  { name: 'Configuración',  href: '/settings',      icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function SidebarContent({
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}) {
  const { profile, signOut } = useAuthStore()
  const { business } = useBusinessStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Define dynamic nav items based on permissions
  const dynamicNav = [...NAV_ITEMS]
  if (profile?.is_superadmin) {
    dynamicNav.push({ name: 'Panel Admin', href: '/admin', icon: Shield })
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <img src={logoSolo} alt="STOCKIA" className="w-8 h-8 shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden text-left">
            <p className="text-sm font-bold text-white leading-none tracking-tight">STOCKIA</p>
            {business?.name && (
              <p className="text-[11px] text-white/40 truncate mt-0.5 max-w-[160px]">{business.name}</p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
        {dynamicNav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onClose}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/55 hover:text-white hover:bg-white/10'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-white/40 group-hover:text-white/80'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.name}</span>
                    {item.premium && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/20 mr-1 animate-pulse">
                        PREMIUM
                      </span>
                    )}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0 space-y-2">
        {/* Subscription status (only desktop desktop-non-collapsed) */}
        {!collapsed && business && (
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group/sub">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/sub:scale-110 transition-transform pointer-events-none">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-bold text-white tracking-widest uppercase">
                  {(!business.plan || business.plan === 'free') ? 'Plan Negocio' : business.plan === 'premium' ? 'Plan Premium' : 'Plan Negocio'}
                </p>
              </div>
              <p className="text-[13px] font-bold text-white mb-0.5">Suscripción activa</p>
              <p className="text-[10px] text-white/30 truncate mb-2">
                ${business.plan === 'premium' ? '100.000' : '50.000'}/mes
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${(calculateRemainingDays(business.trial_ends_at, business.subscription_status) / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-primary shrink-0">
                  {calculateRemainingDays(business.trial_ends_at, business.subscription_status)} días
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleSignOut}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "w-full flex items-center transition-all px-3 py-2.5 rounded-xl hover:bg-white/10 group",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <LogOut className="w-[18px] h-[18px] text-white/40 group-hover:text-white/80 shrink-0" />
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-medium text-white/70 group-hover:text-white truncate">Cerrar sesión</p>
              <p className="text-[10px] text-white/30 truncate">{profile?.email}</p>
            </div>
          )}
        </button>

        {/* Collapse toggle (Desktop only) */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          className="hidden lg:flex w-full items-center justify-center p-2 rounded-xl text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  // Lock scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-300 ease-in-out bg-sidebar border-r border-sidebar-border z-30',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onClose={() => {}}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />
          <div
            className="absolute left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border shadow-2xl animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              collapsed={false}
              onClose={onMobileClose}
              onToggleCollapse={() => {}}
            />
          </div>
        </div>
      )}
    </>
  )
}

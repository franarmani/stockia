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
  MessageCircle,
} from 'lucide-react'

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
  { name: 'WhatsApp',        href: '/whatsapp',      icon: MessageCircle },
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
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-none tracking-tight">STOCKIA</p>
            {business?.name && (
              <p className="text-[11px] text-white/40 truncate mt-0.5 max-w-[160px]">{business.name}</p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
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
      <div className="border-t border-sidebar-border p-3 shrink-0 space-y-1">
        {collapsed ? (
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="w-full flex justify-center p-2.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4 text-white/40" />
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">
                {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/80 truncate">
                {profile?.name ?? 'Usuario'}
              </p>
              <p className="text-[10px] text-white/35">Cerrar sesión</p>
            </div>
            <LogOut className="w-3.5 h-3.5 text-white/25 shrink-0" />
          </button>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="hidden lg:flex w-full items-center justify-center p-1.5 rounded-xl hover:bg-white/10 transition-colors text-white/25 hover:text-white/50"
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
      {/* Desktop: sticky persistent sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onClose={() => {}}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* Mobile: drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={onMobileClose}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 h-full w-64 animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              collapsed={false}
              onClose={onMobileClose}
              onToggleCollapse={onToggleCollapse}
            />
          </div>
        </div>
      )}
    </>
  )
}

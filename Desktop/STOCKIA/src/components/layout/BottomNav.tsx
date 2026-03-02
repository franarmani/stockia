import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  MoreHorizontal,
  Wallet,
  Receipt,
  Truck,
  FileText,
  BarChart3,
  Settings,
  X,
} from 'lucide-react'

const MAIN_NAV = [
  { name: 'Inicio',    href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ventas',    href: '/pos',        icon: ShoppingCart },
  { name: 'Productos', href: '/products',   icon: Package },
  { name: 'Clientes',  href: '/customers',  icon: Users },
]

const MORE_NAV = [
  { name: 'Compras',      href: '/purchases',     icon: Truck },
  { name: 'Comprobantes', href: '/comprobantes',  icon: FileText },
  { name: 'Caja',         href: '/cash-register', icon: Wallet },
  { name: 'Historial',    href: '/sales',         icon: Receipt },
  { name: 'Reportes',     href: '/reports',       icon: BarChart3 },
  { name: 'Configuración',href: '/settings',      icon: Settings },
]

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      {/* ── Bottom bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-bottom">
        <div className="flex items-stretch h-16">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-slate-400'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-slate-400')} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-400 active:text-slate-600"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {/* ── "Más" bottom sheet ── */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-in-up safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-foreground">Navegación</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Grid of items */}
            <div className="grid grid-cols-3 gap-3 p-5">
              {MORE_NAV.map((item) => (
                <button
                  key={item.href}
                  onClick={() => { setMoreOpen(false); navigate(item.href) }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 text-center leading-tight">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Bottom padding for safe area */}
            <div className="h-4" />
          </div>
        </div>
      )}
    </>
  )
}

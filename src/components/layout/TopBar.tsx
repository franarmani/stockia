import ThemeToggle from '@/components/ThemeToggle'
import { Menu, Plus, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SubscriptionBadge from '@/features/subscription/components/SubscriptionBadge'
import { CajaGoIcon } from '@/components/brand/CajaGoBrand'
import OfflineIndicator from '@/components/OfflineIndicator'
import { cn } from '@/lib/utils'

const PAGE_NAMES: Record<string, string> = {
  '/dashboard':    'Inicio',
  '/pos':          'Punto de venta',
  '/products':     'Productos',
  '/customers':    'Clientes',
  '/cash-register':'Caja',
  '/sales':        'Historial',
  '/reports':      'Reportes',
  '/settings':     'Configuración',
  '/comprobantes': 'Comprobantes',
  '/presupuestos': 'Presupuestos',
  '/purchases':    'Compras',
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { profile } = useAuthStore()
  const { business } = useBusinessStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isOnline } = useOnlineStatus()

  const currentPage = PAGE_NAMES[location.pathname] ?? ''
  const showNewSaleBtn = location.pathname !== '/pos'

  return (
    <header className="header h-[54px] flex items-center justify-between px-4 md:px-5 shrink-0 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-[10px] flex items-center justify-center hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors active:translate-y-px shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo - mobile only */}
        <div className="shrink-0 sm:hidden">
          <CajaGoIcon size="sm" />
        </div>

        {/* Logo and Business Info (Desktop) */}
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <CajaGoIcon size="sm" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[14px] text-foreground whitespace-nowrap">
              {business?.name || 'CajaGo'}
            </span>
            <span className="text-[11px] text-[#9CA6BA] font-medium">Dashboard comercial</span>
          </div>
        </div>

        {/* Mobile: page title only */}
        <span className="sm:hidden text-[14px] font-semibold text-foreground truncate">{currentPage}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Online / Offline status badge */}
        <OfflineIndicator />

        {/* Caja abierta (simulated state) */}
        <div className="hidden md:flex items-center px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse-soft"></div>
          <span className="text-[11px] font-semibold text-primary">Caja abierta</span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Subscription badge */}
        <SubscriptionBadge className="hidden md:flex" />

        {/* New sale button */}
        {showNewSaleBtn && (
          <button
            onClick={() => navigate('/pos')}
            className="cg-btn-primary h-9 px-3.5 rounded-xl text-xs gap-2 hidden sm:flex cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white keep-white shrink-0" />
            <span className="text-white keep-white font-bold">Nueva venta</span>
          </button>
        )}

        {/* User avatar */}
        {profile && (
          <div className="w-8 h-8 rounded-[10px] bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0" title={profile.name ?? ''}>
            <span className="text-[12px] font-bold text-white/70">
              {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

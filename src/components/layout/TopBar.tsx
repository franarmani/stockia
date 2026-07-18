import { Menu, Plus, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SubscriptionBadge from '@/features/subscription/components/SubscriptionBadge'
import logo from '@/logosolo.png'
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
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors active:scale-95 shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo - mobile only */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.2)] shrink-0 sm:hidden">
          <img src="/og-image.png" alt="Icono" className="w-5 h-5 object-contain" />
        </div>

        {/* Logo and Business Info (Desktop) */}
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/95 shadow-[0_0_12px_rgba(255,255,255,0.2)] shrink-0">
            <img src="/og-image.png" alt="Icono" className="h-5 w-auto object-contain" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[14px] text-foreground whitespace-nowrap">
              {business?.name || 'STOCKIA HUB'}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">Dashboard comercial</span>
          </div>
        </div>

        {/* Mobile: page title only */}
        <span className="sm:hidden text-[14px] font-semibold text-foreground truncate">{currentPage}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Online status dot */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full',
            isOnline
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isOnline ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="hidden md:inline">{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>

        {/* Caja abierta (simulated state) */}
        <div className="hidden md:flex items-center px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 shadow-[0_0_8px_rgba(25,195,125,0.8)] animate-pulse-soft"></div>
          <span className="text-[11px] font-semibold text-primary">Caja abierta</span>
        </div>

        {/* Subscription badge */}
        <SubscriptionBadge className="hidden md:flex" />

        {/* New sale button */}
        {showNewSaleBtn && (
          <button
            onClick={() => navigate('/pos')}
            className="header-sale-button hidden sm:flex"
          >
            <Plus className="w-[18px] h-[18px]" />
            Nueva venta
          </button>
        )}

        {/* User avatar */}
        {profile && (
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0" title={profile.name ?? ''}>
            <span className="text-[12px] font-bold text-slate-400">
              {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

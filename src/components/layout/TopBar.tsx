import { Menu, Plus, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import logoSolo from '@/logosolo.png'
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
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 md:px-5 shrink-0 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors active:scale-95 shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo - mobile only (desktop shows in sidebar) */}
        <img src={logoSolo} alt="STOCKIA" className="w-7 h-7 shrink-0 lg:hidden" />

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-1.5 text-[13px] min-w-0">
          {business?.name && (
            <>
              <span className="font-semibold text-foreground truncate max-w-[120px]">{business.name}</span>
              {currentPage && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-muted-foreground">{currentPage}</span>
                </>
              )}
            </>
          )}
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
              ? 'bg-green-50 text-green-600'
              : 'bg-slate-100 text-slate-500'
          )}
        >
          {isOnline ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="hidden md:inline">{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>

        {/* New sale button */}
        {showNewSaleBtn && (
          <button
            onClick={() => navigate('/pos')}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-white text-[12px] font-semibold hover:brightness-110 transition-all shadow-sm shadow-green-900/15 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva venta
          </button>
        )}

        {/* User avatar */}
        {profile && (
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0" title={profile.name ?? ''}>
            <span className="text-[12px] font-bold text-slate-500">
              {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

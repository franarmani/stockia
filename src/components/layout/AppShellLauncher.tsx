import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useHotkeys } from '@/hooks/useHotkeys'
import { GlassButton } from '@/components/ui/GlassCard'
import {
  Wifi, WifiOff, LayoutGrid, RefreshCw, Loader2, LogOut, Maximize2, Minimize2, ShieldCheck,
} from 'lucide-react'
import logoSolo from '@/logosolo.png'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import NotificationBell from '@/features/notifications/NotificationBell'
import { useMusicStore } from '@/stores/useMusicStore'
import MiniPlayer from './MiniPlayer'

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
  '/menu':         'Menú',
  '/notifications':'Notificaciones',
  '/health':       'Salud del negocio',
  '/daily-summary':'Resúmenes diarios',
}

export default function AppShellLauncher() {
  useHotkeys()

  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuthStore()
  const { business } = useBusinessStore()
  const { isOnline, pendingCount, syncing, syncPendingSales } = useOnlineStatus()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { initAudio } = useMusicStore()

  useEffect(() => {
    initAudio()
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const isMenu = location.pathname === '/menu'
  const isPOS  = location.pathname === '/pos'
  const currentPage = PAGE_NAMES[location.pathname] ?? ''

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-bg dark-shell min-h-screen flex flex-col">
      {/* ── Fixed glass header ── */}
      <header className="glass-header fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 md:px-6 gap-3">

        {/* Logo + current page context (always visible) */}
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
        >
          <img src={logoSolo} alt="STOCKIA" className="w-7 h-7" />
          <div className="flex flex-col leading-none gap-0.5">
            <span className="text-[13px] font-bold text-white/90 tracking-tight">STOCKIA</span>
            {currentPage && !isMenu && (
              <span className="text-[10px] text-white/40 font-medium">{currentPage}</span>
            )}
          </div>
        </button>

        {/* Business name separator — visible on sm+ */}
        {business?.name && !isMenu && (
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/35 min-w-0">
            <div className="w-px h-4 bg-white/15" />
            <span className="truncate max-w-[140px] md:max-w-[200px]">{business.name}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Offline pill */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-500/15 border border-red-400/20 text-red-300">
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Sin conexión</span>
          </div>
        )}

        {/* Pending sync */}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={!syncing ? syncPendingSales : undefined}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/20 text-amber-300 hover:bg-amber-500/30 transition"
          >
            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            <span>{syncing ? 'Sync...' : `${pendingCount}`}</span>
          </button>
        )}

        {/* Online indicator — visible sm+ */}
        {isOnline && pendingCount === 0 && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-green-400/60">
            <Wifi className="w-3 h-3" />
            <span>En línea</span>
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-xl border border-white/12 bg-white/6 flex items-center justify-center text-white/45 hover:text-white hover:bg-white/12 hover:border-white/20 transition-all active:scale-95"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen
            ? <Minimize2 className="w-3.5 h-3.5" />
            : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Menú button — always visible */}
        <GlassButton
          size="sm"
          onClick={() => navigate('/menu')}
          className={`gap-1.5 border-white/20 hover:text-white ${ isMenu ? 'text-primary border-primary/30 bg-primary/10' : 'text-white/85' }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Menú</span>
        </GlassButton>

        {/* User avatar + dropdown */}
        {profile && (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-xl bg-primary/25 border border-primary/30 flex items-center justify-center text-[12px] font-bold text-primary hover:bg-primary/35 transition"
              title={profile.name ?? ''}
            >
              {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-950 border border-white/10 shadow-2xl rounded-xl overflow-hidden z-50 animate-scale-in">
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-[13px] font-semibold text-white truncate">{profile.name}</p>
                  <p className="text-[11px] text-white/40 truncate">{business?.name}</p>
                </div>
                {profile.email === 'francoarmani107@gmail.com' && (
                  <button
                    onClick={() => { navigate('/admin'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-amber-400 hover:text-amber-300 hover:bg-white/10 transition border-b border-white/5 text-left"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Panel Admin
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white/70 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pt-14 flex flex-col">
        {isPOS ? (
          /* POS gets full-bleed — no padding, no max-width */
          <div className="flex-1 flex flex-col">
            <Outlet />
          </div>
        ) : (
          <div className={cn(
            'flex-1 w-full mx-auto',
            isMenu
              ? 'px-2 sm:px-3 w-full py-6 sm:py-8 h-[calc(100dvh-3.5rem)] overflow-auto flex flex-col justify-center'
              : 'px-4 md:px-6 lg:px-8 max-w-[1440px] py-6 pb-8'
          )}>
            <Outlet />
          </div>
        )}
      </main>

      {/* Persistent global music player */}
      <MiniPlayer />
    </div>
  )
}

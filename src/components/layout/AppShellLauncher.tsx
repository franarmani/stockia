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
import YouTubePlayer from '@/components/music/YouTubePlayer'

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
      {/* ── Fixed premium glass header ── */}
      <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 md:px-6 gap-3 bg-slate-950/40 backdrop-blur-2xl border-b border-white/5 shadow-2xl shadow-black/20">

        {/* Logo + current page context */}
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-all active:scale-95 group"
        >
          <div className="relative">
            <img src={logoSolo} alt="STOCKIA" className="w-7 h-7 relative z-10" />
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[14px] font-black text-white tracking-tight">STOCKIA</span>
            {currentPage && !isMenu && (
              <span className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-0.5">{currentPage}</span>
            )}
          </div>
        </button>

        {/* Context separator */}
        {business?.name && !isMenu && (
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-white/20">
            <div className="w-px h-5 bg-white/10" />
            <div className="flex flex-col leading-none">
               <span className="text-[10px] font-bold text-white/40 truncate max-w-[150px] uppercase tracking-wider">{business.name}</span>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Right Section: Status & Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Sin conexión</span>
            </div>
          )}

          {/* Sync indicator */}
          {isOnline && pendingCount > 0 && (
            <button
              onClick={!syncing ? syncPendingSales : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all"
            >
              {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{syncing ? 'Sincronizando' : `${pendingCount}`}</span>
            </button>
          )}

          {/* Display online sm+ */}
          {isOnline && pendingCount === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/5 text-green-500/40 text-[9px] font-black uppercase tracking-widest border border-green-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Online</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            
            <NotificationBell />

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <button
              onClick={() => navigate('/menu')}
              className={cn(
                "h-8 px-3 rounded-lg flex items-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all",
                isMenu ? "bg-primary text-slate-950" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">Menú</span>
            </button>
          </div>

          {/* Profile */}
          {profile && (
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-9 h-9 rounded-xl overflow-hidden border border-primary/30 flex items-center justify-center bg-primary/10 group transition-all"
              >
                <div className="w-full h-full flex items-center justify-center font-black text-primary text-xs group-hover:scale-110 transition-transform">
                  {profile.name?.charAt(0)?.toUpperCase()}
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-3 w-56 bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                    <p className="text-[13px] font-black text-white truncate leading-none mb-1">{profile.name}</p>
                    <p className="text-[10px] text-white/30 truncate font-bold uppercase tracking-widest">{business?.name}</p>
                  </div>
                  <div className="p-1">
                    {profile.email === 'francoarmani107@gmail.com' && (
                      <button
                        onClick={() => { navigate('/admin'); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-bold text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Panel Admin
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[12px] font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
      <YouTubePlayer />
    </div>
  )
}

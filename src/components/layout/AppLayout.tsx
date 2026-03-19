import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { useState, useEffect } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react'

const SIDEBAR_KEY = 'stockia_sidebar_collapsed'

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const { isOnline, pendingCount, syncing, syncPendingSales } = useOnlineStatus()

  const handleToggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch {}
      return next
    })
  }

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileDrawerOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileDrawerOpen}
        onMobileClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setMobileDrawerOpen(true)} />

        {/* Offline / pending sync banner */}
        {(!isOnline || pendingCount > 0) && (
          <div
            className={`px-4 py-2 flex items-center justify-between text-[12px] font-medium shrink-0 ${
              !isOnline
                ? 'bg-slate-800 text-slate-200'
                : 'bg-amber-50 text-amber-800 border-b border-amber-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Sin conexión — Las ventas se guardan localmente</span>
                </>
              ) : (
                <>
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {syncing
                      ? 'Sincronizando...'
                      : `${pendingCount} venta${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}`}
                  </span>
                </>
              )}
            </div>
            {isOnline && pendingCount > 0 && !syncing && (
              <button
                onClick={syncPendingSales}
                className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
              >
                Sincronizar
              </button>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {/* pb-20 on mobile to clear the bottom nav */}
          <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto w-full pb-20 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav />
    </div>
  )
}

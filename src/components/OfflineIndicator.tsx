import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff, Wifi, CloudUpload, Loader2 } from 'lucide-react'

/**
 * Compact offline/online indicator with pending sale count + sync trigger.
 * Can be placed in TopBar, Sidebar, or floating.
 */
export default function OfflineIndicator({ variant = 'badge' }: { variant?: 'badge' | 'banner' }) {
  const { isOnline, pendingCount, syncing, syncNow } = useOnlineStatus()

  if (variant === 'banner') {
    if (isOnline && pendingCount === 0) return null
    return (
      <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium rounded-xl ${
        !isOnline
          ? 'bg-amber-50 text-amber-800 border border-amber-200'
          : 'bg-blue-50 text-blue-800 border border-blue-200'
      }`}>
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Sin conexión — las ventas se guardan localmente</span>
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              <span>{pendingCount} venta{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
        {isOnline && pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        )}
      </div>
    )
  }

  // Badge variant (compact)
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium ${
        isOnline ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
      }`}>
        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isOnline ? 'Online' : 'Offline'}
      </div>
      {pendingCount > 0 && (
        <button
          onClick={syncNow}
          disabled={syncing || !isOnline}
          className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-xl text-xs font-medium hover:bg-blue-200 disabled:opacity-50 transition"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
          {pendingCount}
        </button>
      )}
    </div>
  )
}

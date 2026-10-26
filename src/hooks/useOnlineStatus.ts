import { useState, useEffect, useCallback } from 'react'
import { syncEngine } from '@/sync/syncEngine'
import { checkConnectivity, isOnline, onConnectivityChange } from '@/sync/connectivity'
import type { SyncStats } from '@/sync/types'
import { toast } from 'sonner'

// Los avisos de conexión se registran una sola vez aunque el hook se use en varios componentes.
let connectivityToastsInstalled = false
function installConnectivityToasts() {
  if (connectivityToastsInstalled) return
  connectivityToastsInstalled = true
  onConnectivityChange((online) => {
    if (online) toast.success('Conexión recuperada · Sincronizando operaciones...')
    else toast.warning('Sin conexión · CajaGo sigue funcionando y guarda todo localmente')
  })
}

export function useOnlineStatus() {
  const [stats, setStats] = useState<SyncStats>({
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    needsLogin: false,
    isSyncing: false,
    lastSyncAt: null,
    online: isOnline(),
    isTauriDesktop: false,
  })

  useEffect(() => {
    syncEngine.init().catch((error) => {
      console.error('[Sync] initialization failed:', error)
      toast.error(`La base local no pudo iniciarse (${error?.message || error}). Reiniciá CajaGo.`, { duration: 15000 })
    })
    installConnectivityToasts()
    return syncEngine.subscribe(setStats)
  }, [])

  const syncNow = useCallback(async () => {
    if (!(await checkConnectivity())) {
      toast.error('Sin conexión con el servidor. Se sincronizará automáticamente al volver.')
      return
    }

    toast.info('Sincronizando operaciones pendientes...')
    const result = await syncEngine.processQueue(true)
    if (result.synced > 0) {
      toast.success(`${result.synced} operación(es) sincronizada(s) con éxito`)
    } else if (result.failed > 0) {
      toast.error(`${result.failed} operación(es) no pudieron sincronizarse. Se reintentará con backoff.`)
    } else {
      toast.success('Todo sincronizado ✓')
    }
  }, [])

  return {
    isOnline: stats.online,
    pendingCount: stats.pendingCount,
    failedCount: stats.failedCount,
    conflictCount: stats.conflictCount,
    needsLogin: stats.needsLogin,
    syncing: stats.isSyncing,
    lastSyncAt: stats.lastSyncAt,
    isTauriDesktop: stats.isTauriDesktop,
    syncNow,
  }
}

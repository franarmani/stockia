import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Bell } from 'lucide-react'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

import { checkIsTauriDesktop } from './sync/storage'
import { installNativeAppGuards } from './desktop/nativeAppGuards'

installNativeAppGuards()

// Aggressive PWA update only in browser/web environment:
if (!checkIsTauriDesktop()) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New version available, reloading...')
      updateSW(true)
    },
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 1000)
      }
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use')
    }
  })

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        expand={false}
        visibleToasts={2}
        gap={8}
        offset={12}
        icons={{
          success: <Bell className="w-4 h-4" />,
          info: <Bell className="w-4 h-4" />,
          warning: <Bell className="w-4 h-4" />,
          error: <Bell className="w-4 h-4" />,
        }}
        toastOptions={{
          duration: 4000,
          className: 'cajago-toast',
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)

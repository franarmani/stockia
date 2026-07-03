import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Aggressive PWA update: automatically reload when a new version is available
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version available, reloading...')
    updateSW(true)
  },
  onRegisteredSW(_url, registration) {
    // SPA client-side routing never triggers the browser's native SW update
    // check (it only runs on full navigations), so poll for updates manually.
    if (registration) {
      setInterval(() => registration.update(), 60 * 1000)
    }
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use')
  }
})

// Reload exactly once the new service worker actually takes control —
// avoids serving a stale precached shell after an update is detected.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  </React.StrictMode>
)

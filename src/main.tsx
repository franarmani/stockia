import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Aggressive PWA update: automatically reload when a new version is available
registerSW({ 
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version available, reloading...')
    window.location.reload()
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use')
  }
})

// Force cache clear on version change
const BUILD_ID = '20260417-perf';
if (localStorage.getItem('stockia_build') !== BUILD_ID) {
  if ('caches' in window) {
    caches.keys().then(names => {
      for (const name of names) caches.delete(name);
    });
  }
  localStorage.setItem('stockia_build', BUILD_ID);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  </React.StrictMode>
)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// ─── Music catalog auto-sync plugin ─────────────────────────────────────
// Scans public/ for audio files and writes public/music-catalog.json

const AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a']
const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
}

function buildSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function syncMusicCatalog(publicDir: string) {
  const catalogPath = path.join(publicDir, 'music-catalog.json')

  // Read existing catalog to preserve manual edits (artist, genre)
  let existing: Record<string, { artist?: string | null; genre?: string | null }> = {}
  try {
    const raw: Array<{ id: string; artist?: string | null; genre?: string | null }> = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'))
    for (const t of raw) existing[t.id] = { artist: t.artist ?? null, genre: t.genre ?? null }
  } catch { /* first run */ }

  const files = fs.readdirSync(publicDir).filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))

  const tracks = files.map((filename, i) => {
    const ext = path.extname(filename).toLowerCase()
    const base = filename.slice(0, -ext.length)
    const id = `local-${buildSlug(base)}`
    const prev = existing[id] ?? {}
    return {
      id,
      title: base,
      artist: prev.artist ?? null,
      genre: prev.genre ?? null,
      audio_path: `/${filename}`,
      mime: MIME[ext] ?? 'audio/mpeg',
    }
  })

  fs.writeFileSync(catalogPath, JSON.stringify(tracks, null, 2) + '\n')
  console.log(`[music-catalog] ✅ ${tracks.length} canción(es) sincronizadas`)
}

function musicCatalogPlugin(): import('vite').Plugin {
  let publicDir: string
  return {
    name: 'music-catalog-sync',
    configResolved(config) {
      publicDir = config.publicDir
      syncMusicCatalog(publicDir)
    },
    configureServer(server) {
      // Watch public dir for audio file changes
      server.watcher.add(path.join(publicDir, '*.{mp3,wav,aac,ogg,flac,m4a}'))
      server.watcher.on('add', (file) => {
        if (AUDIO_EXTS.includes(path.extname(file).toLowerCase())) {
          syncMusicCatalog(publicDir)
          server.ws.send({ type: 'full-reload' })
        }
      })
      server.watcher.on('unlink', (file) => {
        if (AUDIO_EXTS.includes(path.extname(file).toLowerCase())) {
          syncMusicCatalog(publicDir)
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
  }
}
// ───────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [
    musicCatalogPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'STOCKIA',
        short_name: 'STOCKIA',
        description: 'Sistema de gestión y facturación para negocios',
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: '/menu',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache POS and dashboard pages for offline
            urlPattern: /^https:\/\/.*\/(pos|dashboard|products)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 },
            },
          },
          {
            // Cache Supabase REST API calls (products list etc.)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(products|categories)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})

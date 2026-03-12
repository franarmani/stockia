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
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'))
    const allTracks: any[] = Array.isArray(raw)
      ? raw.flatMap((item: any) => (Array.isArray(item.tracks) ? item.tracks : [item]))
      : []
    for (const t of allTracks) existing[t.id] = { artist: t.artist ?? null, genre: t.genre ?? null }
  } catch { /* first run */ }

  const categories: any[] = []
  const entries = fs.readdirSync(publicDir, { withFileTypes: true })

  // Root-level audio files → "Mis Canciones"
  const rootFiles = entries
    .filter(e => e.isFile() && AUDIO_EXTS.includes(path.extname(e.name).toLowerCase()))
    .map(e => e.name)
  if (rootFiles.length > 0) {
    const tracks = rootFiles.map((filename) => {
      const ext = path.extname(filename).toLowerCase()
      const base = filename.slice(0, -ext.length)
      const id = `local-${buildSlug(base)}`
      const prev = existing[id] ?? {}
      return { id, title: base, artist: prev.artist ?? null, genre: prev.genre ?? null, audio_path: `/${filename}`, mime: MIME[ext] ?? 'audio/mpeg' }
    })
    categories.push({ id: 'local-mis-canciones', name: 'Mis Canciones', folder: null, tracks })
  }

  // Subdirectories → each becomes a category
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folder = entry.name
    const folderPath = path.join(publicDir, folder)
    let folderFiles: string[]
    try { folderFiles = fs.readdirSync(folderPath).filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())) }
    catch { continue }
    if (folderFiles.length === 0) continue

    const slug = buildSlug(folder)
    const categoryId = `local-${slug}`
    const tracks = folderFiles.map((filename) => {
      const ext = path.extname(filename).toLowerCase()
      const base = filename.slice(0, -ext.length)
      const id = `${categoryId}-${buildSlug(base)}`
      const prev = existing[id] ?? {}
      return { id, title: base, artist: prev.artist ?? null, genre: prev.genre ?? folder, audio_path: `/${folder}/${filename}`, mime: MIME[ext] ?? 'audio/mpeg' }
    })
    categories.push({ id: categoryId, name: folder, folder, tracks })
  }

  fs.writeFileSync(catalogPath, JSON.stringify(categories, null, 2) + '\n')
  const total = categories.reduce((s: number, c: any) => s + c.tracks.length, 0)
  console.log(`[music-catalog] ✅ ${categories.length} categoría(s), ${total} canción(es) sincronizadas`)
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
      const resolvedPublic = path.resolve(publicDir)

      // Custom audio middleware — Vite's sirv doesn't reliably serve
      // files from public/ subdirectories with URL-encoded paths on Windows.
      // Also adds proper Range support so seeking works.
      server.middlewares.use((req: any, res: any, next: () => void) => {
        const rawPath = (req.url || '').split('?')[0]
        let urlPath: string
        try { urlPath = decodeURIComponent(rawPath) } catch { return next() }
        const ext = path.extname(urlPath).toLowerCase()
        if (!AUDIO_EXTS.includes(ext)) return next()

        // Prevent path traversal
        const filePath = path.resolve(path.join(resolvedPublic, urlPath))
        if (!filePath.startsWith(resolvedPublic + path.sep)) return next()
        if (!fs.existsSync(filePath)) return next()

        const mime = MIME[ext] ?? 'audio/mpeg'
        const fileSize = fs.statSync(filePath).size
        const range = req.headers['range'] as string | undefined

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10)
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
          const chunkSize = end - start + 1
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mime,
          })
          fs.createReadStream(filePath, { start, end }).pipe(res)
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
          })
          fs.createReadStream(filePath).pipe(res)
        }
      })

      // Watch audio files including subdirectories
      server.watcher.add(path.join(publicDir, '**', '*.{mp3,wav,aac,ogg,flac,m4a}'))
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

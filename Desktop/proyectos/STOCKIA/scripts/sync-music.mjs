// scripts/sync-music.mjs
// Escanea public/ y subcarpetas, regenera public/music-catalog.json
// Formato: array de categorías, cada una con sus tracks.
// Uso: node scripts/sync-music.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const CATALOG = path.join(PUBLIC_DIR, 'music-catalog.json')

const AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a']
const MIME = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
}

// Preserve existing artist/genre metadata from previous catalog
let existingMeta = {}
try {
  const raw = JSON.parse(fs.readFileSync(CATALOG, 'utf-8'))
  const flatEntries = Array.isArray(raw) && raw[0]?.tracks ? raw.flatMap(c => c.tracks) : raw
  for (const t of flatEntries) existingMeta[t.id] = { artist: t.artist ?? null, genre: t.genre ?? null }
} catch { /* first run */ }

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function scanDir(dir, folderName) {
  const files = fs.readdirSync(dir)
    .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
    .sort()

  return files.map((filename, i) => {
    const ext = path.extname(filename).toLowerCase()
    const base = filename.slice(0, -ext.length)
    const id = `local-${slugify(folderName)}-${slugify(base)}`
    const prev = existingMeta[id] ?? {}
    return {
      id,
      title: base,
      artist: prev.artist ?? null,
      genre: prev.genre ?? folderName,
      audio_path: `/${folderName}/${filename}`,
      mime: MIME[ext] ?? 'audio/mpeg',
    }
  })
}

const categories = []

// 1. Scan root public/ for loose audio files
const rootFiles = fs.readdirSync(PUBLIC_DIR)
  .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
  .sort()

if (rootFiles.length > 0) {
  const tracks = rootFiles.map((filename) => {
    const ext = path.extname(filename).toLowerCase()
    const base = filename.slice(0, -ext.length)
    const id = `local-${slugify(base)}`
    const prev = existingMeta[id] ?? {}
    return {
      id,
      title: base,
      artist: prev.artist ?? null,
      genre: prev.genre ?? null,
      audio_path: `/${filename}`,
      mime: MIME[ext] ?? 'audio/mpeg',
    }
  })
  categories.push({ id: 'local-mis-canciones', name: 'Mis Canciones', folder: null, tracks })
}

// 2. Scan subfolders (each becomes a category)
const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })
for (const entry of entries) {
  if (!entry.isDirectory()) continue
  // Skip system/build dirs
  if (['node_modules', '.git', 'dist', 'assets'].includes(entry.name)) continue
  const subDir = path.join(PUBLIC_DIR, entry.name)
  const tracks = scanDir(subDir, entry.name)
  if (tracks.length === 0) continue
  categories.push({
    id: `local-${slugify(entry.name)}`,
    name: entry.name,
    folder: entry.name,
    tracks,
  })
}

fs.writeFileSync(CATALOG, JSON.stringify(categories, null, 2) + '\n')

const total = categories.reduce((s, c) => s + c.tracks.length, 0)
console.log(`✅ music-catalog.json actualizado — ${categories.length} categoría(s), ${total} canción(es):`)
categories.forEach(c => {
  console.log(`\n  📁 ${c.name} (${c.tracks.length} tracks)`)
  c.tracks.forEach((t, i) => console.log(`     ${i + 1}. ${t.title}`))
})

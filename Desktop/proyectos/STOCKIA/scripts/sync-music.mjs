// scripts/sync-music.mjs
// Escanea public/ y regenera public/music-catalog.json
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

// Preserve existing artist/genre metadata
let existing = {}
try {
  const raw = JSON.parse(fs.readFileSync(CATALOG, 'utf-8'))
  for (const t of raw) existing[t.id] = { artist: t.artist ?? null, genre: t.genre ?? null }
} catch { /* first run */ }

const files = fs.readdirSync(PUBLIC_DIR)
  .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
  .sort()

const tracks = files.map((filename) => {
  const ext = path.extname(filename).toLowerCase()
  const base = filename.slice(0, -ext.length)
  const id = `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
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

fs.writeFileSync(CATALOG, JSON.stringify(tracks, null, 2) + '\n')
console.log(`✅ music-catalog.json actualizado — ${tracks.length} canción(es):`)
tracks.forEach((t, i) => console.log(`   ${i + 1}. ${t.title} (${t.audio_path})`))

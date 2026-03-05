/**
 * Category Suggestion Engine — "IA" de sugerencia de categorías en tiempo real
 *
 * 3 capas:
 *   A) Reglas rápidas (aliases + keywords)   — ultra veloz, client-side
 *   B) Historial del negocio (feedback)       — trigram similarity
 *   C) Semántica (embeddings)                 — opcional, flag off por defecto
 *
 * Ensamble final: max(rules*1.0, history*0.9, semantic*0.8) + bonus_priority
 */

// ────────────────────────────────────────────
// Normalización
// ────────────────────────────────────────────

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'para', 'con', 'sin', 'por', 'en', 'al', 'a', 'y', 'o', 'e',
  'x', 'c', 'es', 'su', 'se', 'que', 'como',
])

const ACCENT_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u',
  Á: 'a', É: 'e', Í: 'i', Ó: 'o', Ú: 'u', Ü: 'u',
  ñ: 'n', Ñ: 'n',
}

export function normalizeText(s: string): { normalized: string; tokens: string[] } {
  // lowercase + remove accents
  let text = s.toLowerCase()
  text = text.replace(/[áéíóúüÁÉÍÓÚÜñÑ]/g, (ch) => ACCENT_MAP[ch] || ch)
  // replace symbols with spaces
  text = text.replace(/[^a-z0-9\s]/g, ' ')
  // collapse spaces + trim
  text = text.replace(/\s+/g, ' ').trim()
  // tokenize and filter stop words
  const tokens = text.split(' ').filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  return { normalized: tokens.join(' '), tokens }
}

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface CategoryData {
  id: string
  name: string
  parent_id: string | null
  path: string
  keywords: string[]
  priority: number
  business_id: string | null
}

export interface AliasData {
  alias: string
  category_id: string
  weight: number
}

export interface FeedbackRow {
  normalized_name: string
  category_id: string
  chosen_count: number
}

export interface Suggestion {
  category_id: string
  path: string
  name: string
  score: number
  reasons: string[]
  confidence: 'Muy probable' | 'Probable' | 'Sugerencia'
}

// ────────────────────────────────────────────
// Layer A — Rules (aliases + keywords)
// ────────────────────────────────────────────

function scoreRules(
  normalizedName: string,
  tokens: string[],
  categories: CategoryData[],
  aliases: AliasData[]
): Map<string, { score: number; reasons: string[] }> {
  const results = new Map<string, { score: number; reasons: string[] }>()

  function addScore(catId: string, pts: number, reason: string) {
    const existing = results.get(catId) || { score: 0, reasons: [] }
    existing.score += pts
    existing.reasons.push(reason)
    results.set(catId, existing)
  }

  // Alias matches: check if alias is contained within the product name
  for (const a of aliases) {
    const aliasNorm = normalizeText(a.alias).normalized
    if (normalizedName.includes(aliasNorm)) {
      // Exact alias match
      addScore(a.category_id, 60 + a.weight, `Coincide con alias: "${a.alias}"`)
    } else {
      // Check if all alias tokens are present in product tokens
      const aliasTokens = normalizeText(a.alias).tokens
      if (aliasTokens.length > 0 && aliasTokens.every((at) => tokens.some((t) => t.includes(at) || at.includes(t)))) {
        addScore(a.category_id, 40 + a.weight, `Tokens coinciden con: "${a.alias}"`)
      }
    }
  }

  // Keyword matches
  for (const cat of categories) {
    for (const kw of cat.keywords) {
      const kwNorm = normalizeText(kw).normalized
      if (tokens.some((t) => t === kwNorm || t.includes(kwNorm) || kwNorm.includes(t))) {
        addScore(cat.id, 30, `Keyword: "${kw}"`)
        break // only count once per category
      }
    }

    // Parent boost: if matched child, give parent a small bonus
    if (cat.parent_id && results.has(cat.id)) {
      const parentCat = categories.find((c) => c.id === cat.parent_id)
      if (parentCat) {
        addScore(parentCat.id, 10, `Subcategoría "${cat.name}" coincide`)
      }
    }
  }

  return results
}

// ────────────────────────────────────────────
// Layer B — History (feedback)
// ────────────────────────────────────────────

function scoreHistory(
  normalizedName: string,
  feedback: FeedbackRow[]
): Map<string, { score: number; reasons: string[] }> {
  const results = new Map<string, { score: number; reasons: string[] }>()

  for (const fb of feedback) {
    // Exact match
    if (fb.normalized_name === normalizedName) {
      const existing = results.get(fb.category_id) || { score: 0, reasons: [] }
      existing.score = 80 + Math.min(fb.chosen_count * 5, 20)
      existing.reasons.push(`Exacto en historial (${fb.chosen_count}x)`)
      results.set(fb.category_id, existing)
      continue
    }

    // Simple similarity: count common tokens
    const fbTokens = fb.normalized_name.split(' ')
    const nameTokens = normalizedName.split(' ')
    const common = fbTokens.filter((t) => nameTokens.some((nt) => nt === t || nt.includes(t) || t.includes(nt)))
    const similarity = common.length / Math.max(fbTokens.length, nameTokens.length)

    if (similarity >= 0.5) {
      const score = Math.round(40 * similarity) + Math.min(fb.chosen_count * 3, 15)
      const existing = results.get(fb.category_id) || { score: 0, reasons: [] }
      existing.score = Math.max(existing.score, score)
      existing.reasons.push(`Similar a: "${fb.normalized_name}" (historial)`)
      results.set(fb.category_id, existing)
    }
  }

  return results
}

// ────────────────────────────────────────────
// Ensemble
// ────────────────────────────────────────────

export function suggestCategories(
  productName: string,
  categories: CategoryData[],
  aliases: AliasData[],
  feedback: FeedbackRow[]
): Suggestion[] {
  if (!productName || productName.trim().length < 2) return []

  const { normalized, tokens } = normalizeText(productName)
  if (tokens.length === 0) return []

  const rulesScores = scoreRules(normalized, tokens, categories, aliases)
  const historyScores = scoreHistory(normalized, feedback)

  // Build category lookup
  const catMap = new Map(categories.map((c) => [c.id, c]))

  // Ensemble: merge scores
  const combined = new Map<string, { score: number; reasons: string[] }>()

  for (const [catId, data] of rulesScores) {
    combined.set(catId, { score: data.score, reasons: [...data.reasons] })
  }

  for (const [catId, data] of historyScores) {
    const existing = combined.get(catId)
    if (existing) {
      // Take max approach with bonus
      if (data.score * 0.9 > existing.score) {
        existing.score = data.score * 0.9
        existing.reasons = [...data.reasons, ...existing.reasons]
      } else {
        existing.reasons = [...existing.reasons, ...data.reasons]
      }
    } else {
      combined.set(catId, { score: data.score * 0.9, reasons: data.reasons })
    }
  }

  // Add priority bonus
  for (const [catId, data] of combined) {
    const cat = catMap.get(catId)
    if (cat) {
      data.score += cat.priority
    }
  }

  // Sort and return top 3
  const suggestions: Suggestion[] = []
  const sorted = [...combined.entries()].sort((a, b) => b[1].score - a[1].score)

  for (const [catId, data] of sorted.slice(0, 3)) {
    const cat = catMap.get(catId)
    if (!cat || data.score < 15) continue

    suggestions.push({
      category_id: catId,
      path: cat.path || cat.name,
      name: cat.name,
      score: Math.min(Math.round(data.score), 100),
      reasons: data.reasons.slice(0, 3),
      confidence: data.score >= 80 ? 'Muy probable' : data.score >= 55 ? 'Probable' : 'Sugerencia',
    })
  }

  return suggestions
}

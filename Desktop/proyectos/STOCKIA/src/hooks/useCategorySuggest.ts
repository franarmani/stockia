import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  suggestCategories,
  normalizeText,
  type CategoryData,
  type AliasData,
  type FeedbackRow,
  type Suggestion,
} from '@/lib/categorySuggest'

/**
 * Hook: useCategorySuggest
 *
 * Loads categories + aliases + feedback once, then runs the local suggestion
 * engine on every name change (debounced 200ms).
 *
 * Returns:
 * - suggestions: Suggestion[]
 * - loading: boolean
 * - saveFeedback(normalizedName, categoryId): save learning
 */
export function useCategorySuggest(productName: string) {
  const { profile } = useAuthStore()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)

  // Cached data refs — load once
  const categoriesRef = useRef<CategoryData[]>([])
  const aliasesRef = useRef<AliasData[]>([])
  const feedbackRef = useRef<FeedbackRow[]>([])
  const loadedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all data on first mount
  useEffect(() => {
    if (!profile?.business_id || loadedRef.current) return
    loadData()
  }, [profile?.business_id])

  async function loadData() {
    if (!profile?.business_id) return

    const [catRes, aliasRes, feedbackRes] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, parent_id, path, keywords, priority, business_id')
        .or(`business_id.is.null,business_id.eq.${profile.business_id}`)
        .order('priority', { ascending: false }),
      supabase
        .from('category_aliases')
        .select('alias, category_id, weight')
        .or(`business_id.is.null,business_id.eq.${profile.business_id}`),
      supabase
        .from('product_category_feedback')
        .select('normalized_name, category_id, chosen_count')
        .eq('business_id', profile.business_id),
    ])

    categoriesRef.current = (catRes.data as any[]) || []
    aliasesRef.current = (aliasRes.data as any[]) || []
    feedbackRef.current = (feedbackRes.data as any[]) || []
    loadedRef.current = true
  }

  // Debounced suggestion on name change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!productName || productName.trim().length < 3) {
      setSuggestions([])
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(() => {
      const results = suggestCategories(
        productName,
        categoriesRef.current,
        aliasesRef.current,
        feedbackRef.current
      )
      setSuggestions(results)
      setLoading(false)
    }, 200)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [productName])

  // Save feedback when user picks a category
  const saveFeedback = useCallback(
    async (categoryId: string) => {
      if (!profile?.business_id || !productName) return
      const { normalized } = normalizeText(productName)
      if (!normalized) return

      // Upsert: increment chosen_count or insert new
      const { data: existing } = await (supabase
        .from('product_category_feedback') as any)
        .select('id, chosen_count')
        .eq('business_id', profile.business_id)
        .eq('normalized_name', normalized)
        .eq('category_id', categoryId)
        .maybeSingle()

      if (existing) {
        await (supabase
          .from('product_category_feedback') as any)
          .update({
            chosen_count: existing.chosen_count + 1,
            last_chosen_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await (supabase.from('product_category_feedback') as any).insert({
          business_id: profile.business_id,
          normalized_name: normalized,
          category_id: categoryId,
          chosen_count: 1,
          last_chosen_at: new Date().toISOString(),
        })
      }

      // Update local cache
      const fbIdx = feedbackRef.current.findIndex(
        (f) => f.normalized_name === normalized && f.category_id === categoryId
      )
      if (fbIdx >= 0) {
        feedbackRef.current[fbIdx].chosen_count += 1
      } else {
        feedbackRef.current.push({
          normalized_name: normalized,
          category_id: categoryId,
          chosen_count: 1,
        })
      }
    },
    [profile?.business_id, productName]
  )

  return { suggestions, loading, saveFeedback }
}

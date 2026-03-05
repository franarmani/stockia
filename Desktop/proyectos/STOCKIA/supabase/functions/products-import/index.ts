// @ts-nocheck
// Supabase Edge Function: products-import
// POST body: { business_id, mode, match_by, rows[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { business_id, mode, match_by, rows } = await req.json()

    if (!business_id || !rows?.length) {
      return new Response(JSON.stringify({ error: 'Missing business_id or rows' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve / create categories in bulk
    const categoryNames = [...new Set(rows.map((r) => r.category).filter(Boolean))]
    const categoryMap = {}

    if (categoryNames.length > 0) {
      const { data: existingCats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('business_id', business_id)
        .in('name', categoryNames)

      for (const c of existingCats || []) categoryMap[c.name.toLowerCase()] = c.id

      const missing = categoryNames.filter((n) => !categoryMap[n.toLowerCase()])
      if (missing.length > 0) {
        const { data: newCats } = await supabase
          .from('categories')
          .insert(missing.map((name) => ({ business_id, name })))
          .select('id, name')
        for (const c of newCats || []) categoryMap[c.name.toLowerCase()] = c.id
      }
    }

    let created = 0, updated = 0, skipped = 0
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowIndex = i + 2  // 1-based incl. header

      const categoryId = row.category ? (categoryMap[row.category.toLowerCase()] || null) : null
      const payload = {
        business_id,
        name: row.name,
        sale_price: Number(row.sale_price) || 0,
        purchase_price: Number(row.purchase_price) || 0,
        avg_cost: Number(row.purchase_price) || 0,
        stock: Number(row.stock) || 0,
        stock_min: Number(row.stock_min) || 3,
        barcode: row.barcode || null,
        category_id: categoryId,
        unit: row.unit || 'u',
        description: row.description || null,
        brand: row.brand || null,
        active: row.active !== false,
      }

      if (mode === 'create') {
        const { error } = await supabase.from('products').insert(payload)
        if (error) {
          if (error.code === '23505') skipped++
          else errors.push({ rowIndex, field: 'general', message: error.message, value: null })
        } else created++
        continue
      }

      // Find existing
      let existingId = null

      if (match_by === 'barcode' && row.barcode) {
        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('business_id', business_id)
          .eq('barcode', row.barcode)
          .maybeSingle()
        existingId = data?.id
      }

      if (!existingId) {
        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('business_id', business_id)
          .ilike('name', row.name)
          .maybeSingle()
        existingId = data?.id
      }

      if (existingId) {
        if (mode === 'update' || mode === 'upsert') {
          const { error } = await supabase.from('products').update(payload).eq('id', existingId)
          if (error) errors.push({ rowIndex, field: 'general', message: error.message, value: null })
          else updated++
        } else {
          skipped++
        }
      } else {
        if (mode === 'upsert' || mode === 'create') {
          const { error } = await supabase.from('products').insert(payload)
          if (error) errors.push({ rowIndex, field: 'general', message: error.message, value: null })
          else created++
        } else {
          skipped++
        }
      }
    }

    return new Response(JSON.stringify({ created, updated, skipped, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

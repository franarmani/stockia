import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Requests go through our own domain (/supabase-api, proxied in vercel.json) instead
// of directly to supabase.co, since ad-blockers commonly block that domain outright.
const proxiedUrl = import.meta.env.DEV ? supabaseUrl : `${window.location.origin}/supabase-api`

export const supabase = createClient<Database>(proxiedUrl, supabaseAnonKey)

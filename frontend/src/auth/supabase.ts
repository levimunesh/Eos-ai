import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppConfig } from '@/lib/env'

let client: SupabaseClient | null = null

export function getSupabase(config: AppConfig): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

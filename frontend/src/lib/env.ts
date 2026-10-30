export interface AppConfig {
  supabaseUrl: string
  supabaseKey: string
  apiUrl: string
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; missing: string[] }

export const DEFAULT_API_URL = 'http://localhost:8000/api/v1'

export function readConfig(env: Record<string, string | undefined>): ConfigResult {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const missing: string[] = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (missing.length) return { ok: false, missing }
  const apiUrl = (env.VITE_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
  return { ok: true, config: { supabaseUrl, supabaseKey, apiUrl } }
}

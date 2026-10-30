import { readConfig } from '@/lib/env'
import { getSupabase } from '@/auth/supabase'
import { ConfigErrorScreen } from './ConfigErrorScreen'
import { Providers } from './Providers'
import { AppRoutes } from './routes'

export function App() {
  const result = readConfig(import.meta.env as Record<string, string | undefined>)
  if (!result.ok) return <ConfigErrorScreen missing={result.missing} />
  const supabase = getSupabase(result.config)
  return (
    <Providers supabase={supabase} apiUrl={result.config.apiUrl}>
      <AppRoutes />
    </Providers>
  )
}

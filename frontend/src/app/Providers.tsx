import type { SupabaseClient } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { BrowserRouter, useNavigate } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/auth-context'
import { createApiClient, isApiError } from '@/lib/api'
import { ApiContext } from '@/lib/api-context'
import { orgStore } from '@/lib/org-store'
import { ThemeProvider } from '@/lib/theme-context'
import { ToastProvider } from '@/lib/toast'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false
          return count < 2
        },
      },
      mutations: { retry: false },
    },
  })
}

function ApiBridge({ apiUrl, children }: { apiUrl: string; children: ReactNode }) {
  const { supabase } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const api = useMemo(() => {
    const state = { handling: false }
    return createApiClient({
      baseUrl: apiUrl,
      getAccessToken: async () => {
        if (!supabase) return null
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? null
      },
      getOrgId: () => orgStore.get(),
      onUnauthorized: () => {
        // The backend rejected our token: end the session and start again at sign-in.
        if (state.handling) return
        state.handling = true
        orgStore.set(null)
        void (supabase?.auth.signOut() ?? Promise.resolve()).finally(() => {
          state.handling = false
          queryClient.clear()
          navigate('/login?expired=1', { replace: true })
        })
      },
    })
  }, [apiUrl, supabase, navigate, queryClient])

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

export function Providers({
  supabase,
  apiUrl,
  children,
}: {
  supabase: SupabaseClient
  apiUrl: string
  children: ReactNode
}) {
  const [queryClient] = useState(makeQueryClient)
  return (
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider supabase={supabase}>
              <ApiBridge apiUrl={apiUrl}>{children}</ApiBridge>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

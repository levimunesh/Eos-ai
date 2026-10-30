import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { orgStore } from '@/lib/org-store'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ supabase, children }: { supabase: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthState>(
    () => ({
      supabase,
      session,
      loading,
      recovering,
      signOut: async () => {
        orgStore.set(null)
        await supabase.auth.signOut().catch(() => undefined)
        setSession(null)
        queryClient.clear()
      },
    }),
    [supabase, session, loading, recovering, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthState {
  supabase: SupabaseClient | null
  session: Session | null
  /** True until the stored session has been read. */
  loading: boolean
  /** Set when the user arrived from a password-recovery link. */
  recovering: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useSupabase(): SupabaseClient {
  const { supabase } = useAuth()
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { FullPageSpinner } from '@/components/states'
import { safeNext } from '@/lib/format'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!session) {
    const next = location.pathname + location.search
    const to = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
    return <Navigate to={to} replace />
  }
  return <Outlet />
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
}

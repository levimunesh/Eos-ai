import { useMemo, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { ErrorBlock, FullPageSpinner } from '@/components/states'
import { orgStore } from '@/lib/org-store'
import { useMeQuery } from '@/lib/queries'
import { OrgProvider } from './OrgProvider'
import { pickOrgId } from './org-context'

/** Loads /me, picks the current organisation, and sends users without one to onboarding. */
export function OrgGate() {
  const me = useMeQuery()
  const [chosen, setChosen] = useState<string | null>(() => orgStore.get())

  const orgId = useMemo(() => (me.data ? pickOrgId(me.data, chosen) : null), [me.data, chosen])

  if (me.isPending) return <FullPageSpinner />
  if (me.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface">
          <ErrorBlock error={me.error} onRetry={() => void me.refetch()} />
        </div>
      </main>
    )
  }
  if (!orgId) return <Navigate to="/onboarding" replace />

  if (orgStore.get() !== orgId) orgStore.set(orgId)

  return (
    <OrgProvider
      me={me.data}
      orgId={orgId}
      onSwitch={(id) => {
        orgStore.set(id)
        setChosen(id)
      }}
    >
      <Outlet />
    </OrgProvider>
  )
}

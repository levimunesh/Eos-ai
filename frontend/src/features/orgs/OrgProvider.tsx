import { useMemo, type ReactNode } from 'react'
import type { Me } from '@/lib/types'
import { buildOrgState, OrgContext } from './org-context'

export function OrgProvider({
  me,
  orgId,
  onSwitch,
  children,
}: {
  me: Me
  orgId: string
  onSwitch: (id: string) => void
  children: ReactNode
}) {
  const value = useMemo(() => buildOrgState(me, orgId, onSwitch), [me, orgId, onSwitch])
  if (!value) return null
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

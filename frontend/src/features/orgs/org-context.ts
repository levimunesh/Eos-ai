import { createContext, useContext } from 'react'
import type { Me, MembershipSummary, Role } from '@/lib/types'

export interface OrgState {
  me: Me
  orgId: string
  membership: MembershipSummary
  role: Role
  isOwner: boolean
  switchOrg: (orgId: string) => void
}

export const OrgContext = createContext<OrgState | null>(null)

export function useOrg(): OrgState {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}

export function buildOrgState(me: Me, orgId: string, switchOrg: (id: string) => void): OrgState | null {
  const membership = me.memberships.find((m) => m.org_id === orgId)
  if (!membership) return null
  return { me, orgId, membership, role: membership.role, isOwner: membership.role === 'owner', switchOrg }
}

/** Stored choice if still valid, else the first non-demo org, else the first org. */
export function pickOrgId(me: Me, stored: string | null): string | null {
  if (stored && me.memberships.some((m) => m.org_id === stored)) return stored
  return (me.memberships.find((m) => !m.is_demo) ?? me.memberships[0])?.org_id ?? null
}

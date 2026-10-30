import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { OrgContext, type OrgState } from '@/features/orgs/org-context'
import { createApiClient } from '@/lib/api'
import { ApiContext } from '@/lib/api-context'
import type { Me, Role } from '@/lib/types'

export const ORG_ID = '11111111-1111-4111-8111-111111111111'

export function makeMe(role: Role): Me {
  return {
    id: 'user-1',
    email: 'owner@example.com',
    full_name: 'Test User',
    memberships: [{ org_id: ORG_ID, org_name: 'Al Noor Trading', role, is_demo: false }],
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Routes = Record<string, unknown>

/** A fetch mock answering `METHOD /path` keys (path without the base URL). */
export function routeFetch(routes: Routes) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`
    if (key in routes) return jsonResponse(routes[key])
    return jsonResponse({ error: { code: 'not_found', message: `No mock for ${key}`, details: null } }, 404)
  })
}

export function renderWithOrg(ui: ReactElement, { role, routes = {} }: { role: Role; routes?: Routes }) {
  const fetchImpl = routeFetch(routes)
  const api = createApiClient({
    baseUrl: 'http://api.test/api/v1',
    getAccessToken: () => 'test-token',
    getOrgId: () => ORG_ID,
    fetchImpl,
  })
  const me = makeMe(role)
  const org: OrgState = {
    me,
    orgId: ORG_ID,
    membership: me.memberships[0],
    role,
    isOwner: role === 'owner',
    switchOrg: () => undefined,
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const result = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ApiContext.Provider value={api}>
          <OrgContext.Provider value={org}>{ui}</OrgContext.Provider>
        </ApiContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...result, fetchImpl }
}

import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { BranchesPage } from './branches/BranchesPage'
import { MembersPage } from './members/MembersPage'

const branches = [
  { id: 'b1', code: 'MCT1', name: 'Muscat City Centre', city: 'Muscat', is_active: true, created_at: '2026-10-01T00:00:00Z' },
]
const members = [
  {
    membership_id: 'm1',
    user_id: 'user-1',
    email: 'owner@example.com',
    full_name: 'Test User',
    role: 'owner',
    all_branches: true,
    branch_ids: [],
  },
  {
    membership_id: 'm2',
    user_id: 'user-2',
    email: 'viewer@example.com',
    full_name: null,
    role: 'viewer',
    all_branches: false,
    branch_ids: ['b1'],
  },
]
const org = {
  id: 'o',
  name: 'Al Noor Trading',
  base_currency: 'OMR',
  currency_decimals: 3,
  timezone: 'Asia/Muscat',
  fiscal_year_start_month: 1,
  tax_rate: '0.05',
  prices_include_tax: false,
  date_format: 'DD/MM/YYYY',
  is_demo: false,
  created_at: '2026-10-01T00:00:00Z',
}
const routes = {
  'GET /branches': branches,
  'GET /members': members,
  'GET /org': org,
  'GET /invitations': [],
}

describe('role gating', () => {
  it('hides owner-only branch controls from a viewer', async () => {
    renderWithOrg(<BranchesPage />, { role: 'viewer', routes })
    expect(await screen.findByText('Muscat City Centre')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    expect(screen.getByText('Read only')).toBeInTheDocument()
  })

  it('does not load the member list for a viewer', async () => {
    const { fetchImpl } = renderWithOrg(<MembersPage />, { role: 'viewer', routes })
    expect(await screen.findByText(/Only owners and managers can see the member list/)).toBeInTheDocument()
    expect(screen.queryByText('viewer@example.com')).not.toBeInTheDocument()
    const calledMembers = fetchImpl.mock.calls.some(([u]) => String(u).endsWith('/members'))
    expect(calledMembers).toBe(false)
  })

  it('hides owner-only member controls from a manager and skips the invitations call', async () => {
    const { fetchImpl } = renderWithOrg(<MembersPage />, { role: 'manager', routes })
    expect(await screen.findByText('viewer@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit access/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument()
    const calledInvitations = fetchImpl.mock.calls.some(([u]) => String(u).endsWith('/invitations'))
    expect(calledInvitations).toBe(false)
  })

  it('shows the same controls to an owner', async () => {
    renderWithOrg(<BranchesPage />, { role: 'owner', routes })
    expect(await screen.findByText('Muscat City Centre')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add branch' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
  })

  it('shows member actions to an owner', async () => {
    renderWithOrg(<MembersPage />, { role: 'owner', routes })
    expect(await screen.findByText('viewer@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite member' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove viewer@example.com' })).toBeInTheDocument()
    expect(await screen.findByText('Pending invitations')).toBeInTheDocument()
  })
})

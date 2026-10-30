import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { OverviewPage } from './OverviewPage'

describe('overview empty state', () => {
  it('shows no digits in the KPI area', async () => {
    renderWithOrg(<OverviewPage />, { role: 'owner', routes: { 'GET /branches': [] } })

    expect(screen.getByText('No business data yet')).toBeInTheDocument()
    const kpis = screen.getByTestId('kpi-area')
    expect(kpis.textContent).toContain('Net sales')
    expect(kpis.textContent).not.toMatch(/\d/)
  })

  it('links owners to branch setup', async () => {
    renderWithOrg(<OverviewPage />, { role: 'owner', routes: { 'GET /branches': [] } })
    expect(screen.getByRole('link', { name: 'Set up branches' })).toHaveAttribute('href', '/settings/branches')
  })

  it('does not offer setup actions to viewers', () => {
    renderWithOrg(<OverviewPage />, { role: 'viewer' })
    expect(screen.queryByRole('link', { name: 'Set up branches' })).not.toBeInTheDocument()
    expect(screen.getByTestId('kpi-area').textContent).not.toMatch(/\d/)
  })
})

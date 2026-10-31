import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { OverviewPage } from './OverviewPage'

const NOTHING = { 'GET /branches': [], 'GET /imports': [] }

describe('overview empty state', () => {
  it('shows no digits in the KPI area', async () => {
    renderWithOrg(<OverviewPage />, { role: 'owner', routes: NOTHING })

    expect(await screen.findByText('No business data yet')).toBeInTheDocument()
    const kpis = screen.getByTestId('kpi-area')
    expect(kpis.textContent).toContain('Net sales')
    expect(kpis.textContent).not.toMatch(/\d/)
  })

  it('links owners to branch setup', async () => {
    renderWithOrg(<OverviewPage />, { role: 'owner', routes: NOTHING })
    expect(await screen.findByRole('link', { name: 'Set up branches' })).toHaveAttribute('href', '/settings/branches')
  })

  it('does not offer setup actions to viewers', async () => {
    // Viewers can't list imports; the dashboard decides from the KPIs, which are all empty here.
    renderWithOrg(<OverviewPage />, {
      role: 'viewer',
      routes: {
        'GET /org': { id: 'o', name: 'Eos Trading Co.', base_currency: 'OMR', currency_decimals: 3, timezone: 'Asia/Muscat', fiscal_year_start_month: 1, tax_rate: '0.05', prices_include_tax: false, date_format: 'DD/MM/YYYY', is_demo: false, created_at: '2026-01-01T00:00:00Z' },
        'GET /branches': [],
        'GET /analytics/sales': { dimension: 'month', currency: 'OMR', period: { from: '2023-10-01', to: '2026-10-30' }, rows: [] },
      },
    })
    expect(await screen.findByText('No business data yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Set up branches' })).not.toBeInTheDocument()
    expect(screen.getByTestId('kpi-area').textContent).not.toMatch(/\d/)
  })
})

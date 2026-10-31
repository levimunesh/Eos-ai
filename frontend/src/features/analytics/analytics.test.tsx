import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { BRANCHES, ORG, SALE_DETAIL, SALES_PAGE, emptyBreakdown, kpiResponse, months, noDataResponse } from './fixtures'
import { Dashboard } from './Dashboard'
import { readFilters, writeFilters } from './filters'
import { KpiCard } from './KpiCard'
import { changeTone, describeRows, formatKpiValue } from './kpi-format'
import { daysBetween } from './dates'
import { formatDecimal } from './money'
import { SalesRecordsPage } from './SalesRecordsPage'
import type { Kpi } from './types'

const NOW = new Date('2025-03-20T08:00:00Z')

function Location() {
  const l = useLocation()
  return <p data-testid="loc">{l.pathname + l.search}</p>
}

function routes(over: Record<string, unknown> = {}) {
  return {
    'GET /org': ORG,
    'GET /branches': BRANCHES,
    'GET /kpis': kpiResponse(),
    'GET /analytics/sales': (_: RequestInit | undefined, url: URL) =>
      url.searchParams.get('dimension') === 'month' && url.searchParams.get('order') === 'key' ? months() : emptyBreakdown(),
    'GET /records/sales': SALES_PAGE,
    'GET /records/sales/s1': SALE_DETAIL,
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('KPI formatting', () => {
  const money = (value: string): Pick<Kpi, 'unit' | 'value'> => ({ unit: 'money', value })

  it('uses the currency decimals: OMR 3, KWD 3, JPY 0', () => {
    expect(formatKpiValue(money('418364.517'), 'OMR', 3)).toBe('OMR 418,364.517')
    expect(formatKpiValue(money('1234.5'), 'KWD', 3)).toBe('KWD 1,234.500')
    expect(formatKpiValue(money('1234567.6'), 'JPY', 0)).toBe('JPY 1,234,568')
    expect(formatKpiValue({ unit: 'count', value: 48475 }, 'OMR', 3)).toBe('48,475')
    expect(formatKpiValue({ unit: 'ratio', value: '0.3696' }, 'OMR', 3)).toBe('37.0%')
    expect(formatKpiValue(money('8.6305'), 'OMR', 3)).toBe('OMR 8.631')
    expect(formatDecimal('-0.0004', 3)).toBe('0.000')
  })

  it('renders a null value as a dash with a reason', () => {
    const kpi = { ...kpiResponse().kpis[5], value: null, status: 'no_data' as const }
    render(<KpiCard kpi={kpi} currency="OMR" decimals={3} now={NOW.getTime()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('colours increases red for metrics where up is bad, green otherwise', () => {
    expect(changeTone('returns', '0.12')).toEqual({ dir: 'up', tone: 'bad' })
    expect(changeTone('discounts', '0.05').tone).toBe('bad')
    expect(changeTone('operating_expenses', '-0.05').tone).toBe('good')
    expect(changeTone('cogs', '0.01').tone).toBe('bad')
    expect(changeTone('net_sales', '0.13').tone).toBe('good')
    expect(changeTone('net_sales', '-0.13').tone).toBe('bad')
    expect(changeTone('net_sales', null)).toEqual({ dir: null, tone: 'neutral' })

    const returns = kpiResponse().kpis.find((x) => x.key === 'returns')!
    const { unmount } = render(<KpiCard kpi={{ ...returns, change_pct: '0.2' }} currency="OMR" decimals={3} now={NOW.getTime()} />)
    expect(screen.getByLabelText('Up 20.0% on the previous period')).toHaveAttribute('data-tone', 'bad')
    unmount()
    const net = kpiResponse().kpis.find((x) => x.key === 'net_sales')!
    render(<KpiCard kpi={net} currency="OMR" decimals={3} now={NOW.getTime()} />)
    expect(screen.getByLabelText('Up 13.4% on the previous period')).toHaveAttribute('data-tone', 'good')
  })

  it('shows notes and coverage for partial KPIs', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const gp = kpiResponse().kpis.find((x) => x.key === 'gross_profit')!
    render(<KpiCard kpi={gp} currency="OMR" decimals={3} now={NOW.getTime()} />)
    await user.click(screen.getByRole('button', { name: /^Partial/ }))
    const pop = await screen.findByRole('dialog')
    expect(within(pop).getByText('93.7% of net sales have a unit cost')).toBeInTheDocument()
    expect(within(pop).getByText('Unit cost is missing for items worth 6.3% of net sales')).toBeInTheDocument()
    expect(within(pop).getByText('Sales, Product costs')).toBeInTheDocument()
  })

  it('describes source rows compactly', () => {
    expect(describeRows([3, 2])).toBe('rows 2–3')
    expect(describeRows([7])).toBe('row 7')
    expect(describeRows([2, 4, 5, 6, 9])).toBe('rows 2, 4–6, 9')
  })
})

describe('filters in the URL', () => {
  it('round-trips presets, custom ranges, branches and compare', () => {
    const p = writeFilters(new URLSearchParams(), { preset: 'custom', from: '2025-02-01', to: '2025-02-28', branchIds: ['b1', 'b2'], compare: false })
    expect(p.toString()).toBe('period=custom&from=2025-02-01&to=2025-02-28&branches=b1%2Cb2&compare=0')
    const f = readFilters(p, '2025-03-20')
    expect(f).toMatchObject({ preset: 'custom', from: '2025-02-01', to: '2025-02-28', branchIds: ['b1', 'b2'], compare: false, isDefault: false })
    expect(readFilters(new URLSearchParams('period=last_month'), '2025-03-20')).toMatchObject({ from: '2025-02-01', to: '2025-02-28' })
    expect(readFilters(new URLSearchParams(), '2025-03-20')).toMatchObject({ preset: 'this_month', from: '2025-03-01', to: '2025-03-20', isDefault: true, compare: true })
  })

  it('updates the URL and refetches KPIs when a preset is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { fetchImpl } = renderWithOrg(
      <>
        <Dashboard empty={<p>empty</p>} />
        <Location />
      </>,
      { role: 'owner', routes: routes(), path: '/?period=this_month' },
    )
    expect(await screen.findByTestId('kpi-net_sales')).toHaveTextContent('40,289.545')
    await user.click(screen.getByRole('button', { name: /^Period: This month/ }))
    await user.click(await screen.findByRole('option', { name: 'Last month' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('period=last_month')
    await waitFor(() => {
      const urls = fetchImpl.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/kpis?'))
      expect(urls.some((u) => u.includes('from=2025-02-01') && u.includes('to=2025-02-28'))).toBe(true)
    })

    await user.click(screen.getByRole('switch', { name: 'Compare with previous period' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('compare=0')
    await waitFor(() => {
      const urls = fetchImpl.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/kpis?'))
      expect(urls.at(-1)).toContain('compare=none')
    })
  })

  it('writes the segmented quick picks to the URL and marks the active one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { fetchImpl } = renderWithOrg(
      <>
        <Dashboard empty={<p>empty</p>} />
        <Location />
      </>,
      { role: 'owner', routes: routes(), path: '/?period=this_month' },
    )
    await screen.findByTestId('kpi-net_sales')
    const group = screen.getByRole('radiogroup', { name: 'Period' })
    expect(within(group).getByRole('button', { name: /^Period: This month/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('radio', { name: 'Last 30 days' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('period=last_30_days')
    expect(within(group).getByRole('radio', { name: 'Last 30 days' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('button', { name: /^Period: Last 30 days/ })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => {
      const urls = fetchImpl.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/kpis?'))
      expect(urls.at(-1)).toContain('from=2025-02-19')
      expect(urls.at(-1)).toContain('to=2025-03-20')
    })
    // The branch chip and the insights endpoint follow the same range.
    await waitFor(() => expect(fetchImpl.mock.calls.map(([u]) => String(u)).some((u) => u.includes('/insights?') && u.includes('from=2025-02-19'))).toBe(true))
  })
})

describe('dashboard states', () => {
  it('falls back to the empty state when every KPI has no data', async () => {
    renderWithOrg(<Dashboard empty={<p>empty state</p>} />, {
      role: 'owner',
      routes: routes({ 'GET /kpis': noDataResponse(), 'GET /analytics/sales': emptyBreakdown('month') }),
    })
    expect(await screen.findByText('empty state')).toBeInTheDocument()
    expect(screen.queryByTestId('kpi-net_sales')).not.toBeInTheDocument()
  })

  it('falls back to the latest month with data and says so', async () => {
    vi.setSystemTime(new Date('2025-10-15T08:00:00Z'))
    const { fetchImpl } = renderWithOrg(<Dashboard empty={<p>empty</p>} />, { role: 'owner', routes: routes() })
    expect(await screen.findByText(/No sales recorded in October 2025 yet, so this shows March 2025/)).toBeInTheDocument()
    const search = fetchImpl.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.searchParams.get('dimension') === 'month')!
    expect(daysBetween(search.searchParams.get('from')!, search.searchParams.get('to')!)).toBeLessThanOrEqual(3 * 366)
    await waitFor(() => {
      const urls = fetchImpl.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/kpis?'))
      expect(urls.at(-1)).toContain('from=2025-03-01')
      expect(urls.at(-1)).toContain('to=2025-03-31')
    })
  })

  it('only offers a branch-scoped viewer their own branches', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // The API already scopes /branches to what the user can see.
    renderWithOrg(<Dashboard empty={<p>empty</p>} />, {
      role: 'viewer',
      routes: routes({ 'GET /branches': [BRANCHES[0], BRANCHES[1]] }),
      path: '/?period=this_month',
    })
    await user.click(await screen.findByRole('button', { name: /^Branches: All branches/ }))
    expect(await screen.findByLabelText(/EOS-01/)).toBeInTheDocument()
    expect(screen.getByLabelText(/EOS-02/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/EOS-03/)).not.toBeInTheDocument()
  })
})

describe('sales records', () => {
  it('opens a receipt sheet with its lines and source rows', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithOrg(
      <Routes>
        <Route path="/records/sales" element={<SalesRecordsPage />} />
      </Routes>,
      { role: 'viewer', routes: routes(), path: '/records/sales?period=this_month' },
    )
    const table = await screen.findByRole('table', { name: 'Sales receipts' })
    expect(within(table).getByText('Refund of R104102')).toBeInTheDocument()
    await user.click(within(table).getByRole('button', { name: 'Open receipt R104417' }))
    const sheet = await screen.findByRole('dialog', { name: 'Receipt R104417' })
    expect(await within(sheet).findByText('Dates, Khalas 500g')).toBeInTheDocument()
    expect(within(sheet).getByTestId('sale-source')).toHaveTextContent('From sales.csv, rows 2–3')
    expect(within(sheet).getByText('4.427')).toBeInTheDocument()
  })

  it('sends status and receipt search filters to the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { fetchImpl } = renderWithOrg(
      <Routes>
        <Route path="/records/sales" element={<SalesRecordsPage />} />
      </Routes>,
      { role: 'owner', routes: routes(), path: '/records/sales?period=this_month' },
    )
    await screen.findByRole('table', { name: 'Sales receipts' })
    await user.selectOptions(screen.getByLabelText('Status'), 'refund')
    await user.type(screen.getByLabelText('Search receipt number'), 'R1044')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    await waitFor(() => {
      const last = fetchImpl.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/records/sales?')).at(-1)!
      expect(last).toContain('status=refund')
      expect(last).toContain('receipt=R1044')
    })
  })
})

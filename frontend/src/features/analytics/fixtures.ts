import type { BreakdownResponse, Kpi, KpiResponse, SaleDetail, SalesPage } from './types'

export const ORG = {
  id: 'o',
  name: 'Eos Trading Co.',
  base_currency: 'OMR',
  currency_decimals: 3,
  timezone: 'Asia/Muscat',
  fiscal_year_start_month: 1,
  tax_rate: '0.0500',
  prices_include_tax: false,
  date_format: 'DD/MM/YYYY',
  is_demo: false,
  created_at: '2025-01-01T00:00:00Z',
}

export const BRANCHES = [
  { id: 'b1', code: 'EOS-01', name: 'Eos Central', city: 'Muscat', is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'b2', code: 'EOS-02', name: 'Eos North', city: 'Sohar', is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'b3', code: 'EOS-03', name: 'Eos Coast', city: 'Sur', is_active: true, created_at: '2025-01-01T00:00:00Z' },
]

const k = (key: Kpi['key'], label: string, unit: Kpi['unit'], value: Kpi['value'], change: string | null, over: Partial<Kpi> = {}): Kpi => ({
  key,
  label,
  unit,
  value,
  previous_value: null,
  change_pct: change,
  status: 'complete',
  coverage_pct: '1.0000',
  row_count: 6214,
  notes: [],
  sources: ['sales'],
  last_import_at: '2026-10-30T07:40:00Z',
  ...over,
})

const costPartial = {
  status: 'partial' as const,
  coverage_pct: '0.9373',
  notes: ['Unit cost is missing for items worth 6.3% of net sales'],
  sources: ['sales', 'product_costs'],
}

export function kpiResponse(over: Partial<KpiResponse> = {}, decimals = 3, currency = 'OMR'): KpiResponse {
  return {
    currency,
    currency_decimals: decimals,
    period: { from: '2025-03-01', to: '2025-03-31' },
    previous_period: { from: '2025-01-29', to: '2025-02-28' },
    branch_ids: null,
    kpis: [
      k('gross_sales', 'Gross sales', 'money', '41892.640', '0.1384'),
      k('discounts', 'Discounts', 'money', '1214.880', '0.2210'),
      k('returns', 'Returns', 'money', '388.215', '-0.0431'),
      k('net_sales', 'Net sales', 'money', '40289.545', '0.1342'),
      k('transactions', 'Transactions', 'count', 4612, '0.0917'),
      k('avg_ticket', 'Average ticket', 'money', '8.736', '0.0389'),
      k('cogs', 'Cost of goods sold', 'money', '25398.112', '0.1196', costPartial),
      k('gross_profit', 'Gross profit', 'money', '14891.433', '0.1601', costPartial),
      k('gross_margin', 'Gross margin', 'ratio', '0.3696', '0.0228', costPartial),
      k('operating_expenses', 'Operating expenses', 'money', '9120.000', '0.0050', { sources: ['expenses'], row_count: 38 }),
      k('inventory_value', 'Inventory value', 'money', '58410.775', null, {
        sources: ['inventory_counts'],
        row_count: 912,
        notes: ['As of the latest stock count per branch: EOS-01 2025-03-28, EOS-02 2025-03-28, EOS-03 2025-03-27'],
      }),
    ],
    ...over,
  }
}

export function noDataResponse(): KpiResponse {
  const r = kpiResponse()
  return { ...r, kpis: r.kpis.map((x) => ({ ...x, status: 'no_data', value: x.unit === 'count' ? 0 : null, change_pct: null, row_count: 0 })) }
}

export function months(): BreakdownResponse {
  const rows = [
    ['2025-01', '32410.880', 3790],
    ['2025-02', '35521.402', 4225],
    ['2025-03', '40289.545', 4612],
  ] as const
  return {
    dimension: 'month',
    currency: 'OMR',
    period: { from: '2022-10-01', to: '2025-10-30' },
    rows: rows.map(([key, net, tx]) => ({ key, label: key, net_sales: net, transactions: tx, qty: '0', cogs: '0', gross_profit: '0', cost_coverage_pct: '1' })),
  }
}

export function emptyBreakdown(dimension: BreakdownResponse['dimension'] = 'day'): BreakdownResponse {
  return { dimension, currency: 'OMR', period: { from: '2025-03-01', to: '2025-03-31' }, rows: [] }
}

export const SALES_PAGE: SalesPage = {
  total: 2,
  limit: 50,
  offset: 0,
  rows: [
    {
      id: 's1',
      receipt_no: 'R104417',
      branch_code: 'EOS-01',
      sold_at: '2025-03-14T15:31:00+00:00',
      business_date: '2025-03-14',
      status: 'completed',
      currency: 'OMR',
      ref_receipt_no: null,
      lines: 2,
      net: '4.427',
      source: { import_id: 'imp-1', file_name: 'sales.csv', row: 2 },
    },
    {
      id: 's2',
      receipt_no: 'R104418',
      branch_code: 'EOS-02',
      sold_at: '2025-03-14T16:05:00+00:00',
      business_date: '2025-03-14',
      status: 'refund',
      currency: 'OMR',
      ref_receipt_no: 'R104102',
      lines: 1,
      net: '-0.673',
      source: { import_id: 'imp-1', file_name: 'sales.csv', row: 4 },
    },
  ],
}

export const SALE_DETAIL: SaleDetail = {
  id: 's1',
  receipt_no: 'R104417',
  branch_code: 'EOS-01',
  sold_at: '2025-03-14T15:31:00+00:00',
  business_date: '2025-03-14',
  status: 'completed',
  currency: 'OMR',
  ref_receipt_no: null,
  customer_ref: null,
  source: { import_id: 'imp-1', file_name: 'sales.csv' },
  lines: [
    { id: 'l1', sku: 'SKU-0050', name: 'Dates, Khalas 500g', description: null, qty: '2.000', unit_price: '1.250', discount: '0.000', tax: '0.125', net: '2.500', source_row: 2 },
    { id: 'l2', sku: 'SKU-0049', name: 'Laban 1L', description: null, qty: '1.000', unit_price: '1.927', discount: '0.000', tax: '0.096', net: '1.927', source_row: 3 },
  ],
}

export type KpiKey =
  | 'gross_sales'
  | 'discounts'
  | 'returns'
  | 'net_sales'
  | 'transactions'
  | 'avg_ticket'
  | 'cogs'
  | 'gross_profit'
  | 'gross_margin'
  | 'operating_expenses'
  | 'inventory_value'

export type KpiStatus = 'complete' | 'partial' | 'no_data'

export interface Kpi {
  key: KpiKey
  label: string
  unit: 'money' | 'count' | 'ratio'
  value: string | number | null
  previous_value: string | number | null
  change_pct: string | null
  status: KpiStatus
  coverage_pct: string
  row_count: number
  notes: string[]
  sources: string[]
  last_import_at: string | null
}

export interface Period {
  from: string
  to: string
}

export interface KpiResponse {
  currency: string
  currency_decimals: number
  period: Period
  previous_period: Period | null
  branch_ids: string[] | null
  kpis: Kpi[]
}

export type Dimension = 'day' | 'month' | 'branch' | 'category' | 'product'
export type BreakdownOrder = 'net' | 'key' | 'gross_profit' | 'qty'

export interface BreakdownRow {
  key: string
  label: string
  net_sales: string
  transactions: number
  qty: string
  cogs: string
  gross_profit: string
  cost_coverage_pct: string
}

export interface BreakdownResponse {
  dimension: Dimension
  currency: string
  period: Period
  rows: BreakdownRow[]
}

export type SaleStatus = 'completed' | 'refund' | 'voided'

export interface SaleRow {
  id: string
  receipt_no: string
  branch_code: string
  sold_at: string
  business_date: string
  status: SaleStatus
  currency: string
  ref_receipt_no: string | null
  lines: number
  net: string
  source: { import_id: string | null; file_name: string | null; row: number | null }
}

export interface SalesPage {
  total: number
  limit: number
  offset: number
  rows: SaleRow[]
}

export interface SaleLine {
  id: string
  sku: string | null
  name: string | null
  description: string | null
  qty: string
  unit_price: string
  discount: string
  tax: string
  net: string
  source_row: number | null
}

export interface SaleDetail {
  id: string
  receipt_no: string
  branch_code: string
  sold_at: string
  business_date: string
  status: SaleStatus
  currency: string
  ref_receipt_no: string | null
  customer_ref: string | null
  source: { import_id: string | null; file_name: string | null }
  lines: SaleLine[]
}

/** Metrics where a rise is bad news. */
export const UP_IS_BAD: KpiKey[] = ['returns', 'discounts', 'operating_expenses', 'cogs']

/** Cards that can open the sales drill-down. */
export const SALES_KPIS: KpiKey[] = ['gross_sales', 'discounts', 'returns', 'net_sales', 'transactions', 'avg_ticket', 'cogs', 'gross_profit']

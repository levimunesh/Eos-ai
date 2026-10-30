import type { EntityType, ImportRecord, QualityReport } from './types'

const f = (key: string, label: string, required = false, kind = 'text', help = '') => ({ key, label, kind, required, help })

export const ENTITIES: EntityType[] = [
  { key: 'branches', label: 'Branches', description: 'Stores, outlets or locations.', owner_only: true, depends_on: [], fields: [f('code', 'Branch code', true, 'code'), f('name', 'Branch name', true), f('city', 'City')] },
  { key: 'products', label: 'Products', description: 'Items you sell or buy.', owner_only: false, depends_on: [], fields: [f('sku', 'Product code (SKU)', true, 'code'), f('name', 'Product name', true)] },
  {
    key: 'sales',
    label: 'Sales',
    description: 'One row per sold line (receipt + item). Refunds and voids included.',
    owner_only: false,
    depends_on: ['branches', 'products'],
    fields: [
      f('receipt_no', 'Receipt / invoice no.', true, 'code'),
      f('branch_code', 'Branch code', true, 'code', 'Must match a branch code set up in EOS.'),
      f('sold_at', 'Date / time', true, 'datetime'),
      f('sku', 'Product code (SKU)', true, 'code'),
      f('description', 'Item description'),
      f('qty', 'Quantity', true, 'decimal'),
      f('unit_price', 'Unit price (before tax)', true, 'decimal'),
      f('discount', 'Discount amount', false, 'decimal'),
      f('tax', 'Tax / VAT amount', false, 'decimal'),
      f('currency', 'Currency', false, 'currency', "Three-letter code. If missing, the organisation's base currency is used."),
      f('status', 'Status', false, 'status', 'Completed, refund/return, or void. Negative quantities count as refunds.'),
      f('line_no', 'Line number', false, 'code'),
    ],
  },
]

export const HEADERS = ['Receipt No', 'Branch', 'Date', 'Item Code', 'Qty', 'Unit Price', 'Discount', 'VAT', 'Currency', 'Status']

const ROWS: string[][] = [
  ['R100001', 'EOS-01', '01/01/2025 09:23', 'SKU-0050', '1', '0.673', '0', '0.0337', 'OMR', 'COMPLETED'],
  ['R100002', 'EOS-01', '01/01/2025 19:31', 'SKU-0049', '2', '0.877', '0', '0.0877', 'OMR', 'COMPLETED'],
  ['R100003', 'EOS-02', '01/01/2025 11:02', 'SKU-0012', '3', '1.250', '0.250', '0.1750', 'OMR', 'COMPLETED'],
  ['R100004', 'EOS-02', '02/01/2025 08:47', 'SKU-0031', '1', '4.500', '0', '0.2250', 'OMR', 'COMPLETED'],
  ['R100005', 'EOS-03', '02/01/2025 13:15', 'SKU-0008', '6', '0.420', '0', '0.1260', 'OMR', 'COMPLETED'],
  ['R100006', 'EOS-01', '02/01/2025 17:58', 'SKU-0050', '-1', '0.673', '0', '-0.0337', 'OMR', 'REFUND'],
  ['R100007', 'EOS-09', '03/01/2025 10:05', 'SKU-0077', '2', '2.100', '0', '0.2100', 'OMR', 'COMPLETED'],
  ['R100008', 'EOS-02', '31/02/2025 12:40', 'SKU-0012', '1', '1.250', '0', '0.0625', 'OMR', 'COMPLETED'],
  ['R100009', 'EOS-01', '03/01/2025 16:22', 'SKU-0204', '1', '3.300', '0', '0.1650', 'AED', 'COMPLETED'],
  ['R100010', 'EOS-03', '03/01/2025 19:09', 'SKU-0008', '2', '0.420', '0', '0.0420', 'OMR', 'COMPLETED'],
]

export const COLUMN_MAP = {
  receipt_no: 'Receipt No',
  branch_code: 'Branch',
  sold_at: 'Date',
  sku: 'Item Code',
  qty: 'Qty',
  unit_price: 'Unit Price',
  discount: 'Discount',
  tax: 'VAT',
  currency: 'Currency',
  status: 'Status',
}

export const REPORT: QualityReport = {
  dry_run: true,
  conflict_mode: 'skip',
  rows_total: 4812,
  rows_valid: 4655,
  rows_rejected: 121,
  rows_duplicate: 36,
  duplicates: { in_file: 12, already_in_eos: 24 },
  replaced_records: 0,
  blank_rows_ignored: 3,
  errors_by_code: { unknown_product: 58, unknown_branch: 37, invalid_datetime: 19, not_a_number: 7 },
  errors_sample: [
    { row: 8, column: 'Branch', code: 'unknown_branch', message: "Branch 'EOS-09' isn't set up in EOS" },
    { row: 9, column: 'Date', code: 'invalid_datetime', message: "'31/02/2025 12:40' is not a valid date and time" },
    { row: 10, column: 'Item Code', code: 'unknown_product', message: "Product 'SKU-0204' isn't set up in EOS" },
    { row: 214, column: 'Qty', code: 'not_a_number', message: "'two' is not a number" },
    { row: 377, column: 'Branch', code: 'unknown_branch', message: "Branch 'EOS-09' isn't set up in EOS" },
  ],
  totals: {
    date_range: { from: '2025-01-01', to: '2025-03-31' },
    receipts: 1987,
    receipt_status: { completed: 1941, refund: 39, void: 7 },
    by_branch: {
      'EOS-01': { receipts: 842, lines: 2011, net_by_currency: { OMR: '6214.385', AED: '312.500' } },
      'EOS-02': { receipts: 701, lines: 1622, net_by_currency: { OMR: '5108.940' } },
      'EOS-03': { receipts: 444, lines: 1022, net_by_currency: { OMR: '2876.215' } },
    },
    currencies: { OMR: 1975, AED: 12 },
  },
  warnings: [
    'Rejected lines are left out; receipts that also had valid lines are imported without them. Fix and re-import the error rows to complete them.',
    '12 AED receipts have no exchange rate for their date, so they will be left out of OMR totals until rates are imported.',
  ],
  generated_at: '2026-10-30T09:15:00Z',
}

export function makeImport(over: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'imp-1',
    entity_type: 'sales',
    file_name: 'sales_q1_2025.csv',
    file_size: 412_884,
    status: 'uploaded',
    options: { header_row: 0, sheet: null, date_format: 'DD/MM/YYYY', thousands_separator: null },
    column_map: { ...COLUMN_MAP },
    preview: {
      headers: HEADERS,
      rows: ROWS,
      row_count: 4815,
      header_row: 0,
      sheet: null,
      sheets: [],
      encoding: 'utf-8',
      delimiter: ',',
      columns: [],
      suggestions: Object.fromEntries(
        Object.entries(COLUMN_MAP).map(([k, v]) => [k, { column: v, confidence: k === 'status' ? 0.7 : 0.95 }]),
      ),
      mapping_source: 'suggested',
      same_file_imported_before: [],
    },
    quality_report: null,
    conflict_mode: null,
    rows_total: null,
    rows_imported: null,
    rows_rejected: null,
    rows_duplicate: null,
    queued_at: null,
    started_at: null,
    finished_at: null,
    last_error: null,
    created_at: '2026-10-30T09:10:00Z',
    ...over,
  }
}

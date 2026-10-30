export type ImportStatus = 'uploaded' | 'mapped' | 'validating' | 'validated' | 'importing' | 'done' | 'failed'
export type ConflictMode = 'skip' | 'replace'
export type ThousandsSeparator = null | ',' | ' ' | '.' | "'"

export interface EntityField {
  key: string
  label: string
  kind: string
  required: boolean
  help: string
}

export interface EntityType {
  key: string
  label: string
  description: string
  owner_only: boolean
  depends_on: string[]
  fields: EntityField[]
}

export interface ColumnProfile {
  name: string
  inferred_type: string
  blank_pct: number
  distinct: number
  samples: string[]
  date_order_hint: string | null
}

export interface Suggestion {
  column: string | null
  confidence: number
}

export interface ImportPreview {
  headers: string[]
  rows: (string | null)[][]
  row_count: number
  header_row: number
  sheet: string | null
  sheets: string[]
  encoding: string | null
  delimiter: string | null
  columns: ColumnProfile[]
  suggestions?: Record<string, Suggestion> | null
  mapping_source?: 'suggested' | 'saved' | 'user'
  date_format_hint?: string
  same_file_imported_before?: { id: string; created_at: string; status: ImportStatus }[]
}

export interface ImportOptions {
  header_row?: number | null
  sheet?: string | null
  date_format?: string | null
  thousands_separator?: ThousandsSeparator
}

export interface ErrorSample {
  row: number
  column: string | null
  code: string
  message: string
}

export interface BranchTotals {
  receipts: number
  lines: number
  net_by_currency: Record<string, string>
}

export interface QualityReport {
  dry_run: boolean
  conflict_mode: ConflictMode
  rows_total: number
  rows_valid: number
  rows_rejected: number
  rows_duplicate: number
  duplicates: { in_file: number; already_in_eos: number }
  replaced_records: number
  blank_rows_ignored: number
  errors_by_code: Record<string, number>
  errors_sample: ErrorSample[]
  totals: {
    date_range?: { from: string; to: string } | null
    receipts?: number
    receipt_status?: Record<string, number>
    by_branch?: Record<string, BranchTotals>
    currencies?: Record<string, number> | string[]
    by_category?: Record<string, string>
    value_by_currency?: Record<string, string>
    documents?: number
    [key: string]: unknown
  }
  warnings: string[]
  generated_at: string
}

export interface ImportRecord {
  id: string
  entity_type: string
  file_name: string
  file_size: number
  status: ImportStatus
  options: ImportOptions
  column_map: Record<string, string>
  preview: ImportPreview
  quality_report: QualityReport | null
  conflict_mode: ConflictMode | null
  rows_total: number | null
  rows_imported: number | null
  rows_rejected: number | null
  rows_duplicate: number | null
  queued_at: string | null
  started_at: string | null
  finished_at: string | null
  last_error: string | null
  created_at: string
}

export interface ImportSummary {
  id: string
  entity_type: string
  file_name: string
  status: ImportStatus
  rows_total: number | null
  rows_imported: number | null
  rows_rejected: number | null
  rows_duplicate: number | null
  created_at: string
  finished_at: string | null
}

/** Recommended order; anything else sorts after. */
export const ENTITY_ORDER = [
  'branches',
  'products',
  'suppliers',
  'fx_rates',
  'product_costs',
  'sales',
  'purchases',
  'expenses',
  'inventory_counts',
]

export function sortEntities<T extends { key: string }>(list: T[]): T[] {
  const rank = (k: string) => {
    const i = ENTITY_ORDER.indexOf(k)
    return i === -1 ? ENTITY_ORDER.length : i
  }
  return [...list].sort((a, b) => rank(a.key) - rank(b.key))
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

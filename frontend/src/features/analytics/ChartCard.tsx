import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorBlock } from '@/components/states'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

export interface ChartTable {
  columns: string[]
  rows: (string | number)[][]
}

/** Frame for every chart: title, optional controls, loading skeleton, empty state, table view. */
export function ChartCard({
  title,
  subtitle,
  controls,
  legend,
  loading,
  error,
  onRetry,
  empty,
  recordsHref,
  table,
  summary,
  height = 260,
  children,
  className,
}: {
  title: string
  subtitle?: string
  controls?: ReactNode
  legend?: ReactNode
  loading: boolean
  error?: unknown
  onRetry?: () => void
  empty: boolean
  recordsHref?: string
  table?: ChartTable
  summary?: string
  height?: number
  children: ReactNode
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  const titleId = `chart-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={titleId} className={cn('surface-raised flex min-w-0 flex-col rounded-xl', className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[0.9375rem] font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {controls}
          {table && !empty && !loading && (
            <button
              type="button"
              aria-pressed={asTable}
              aria-label={asTable ? t('dashboard.charts.showChart') : t('dashboard.charts.showTable')}
              title={asTable ? t('dashboard.charts.showChart') : t('dashboard.charts.showTable')}
              onClick={() => setAsTable((v) => !v)}
              className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg sm:size-8"
            >
              {asTable ? <BarChart3 aria-hidden className="size-4" /> : <Table2 aria-hidden className="size-4" />}
            </button>
          )}
        </div>
      </header>
      {legend && !empty && !loading && <div className="px-4 pt-2 sm:px-5">{legend}</div>}
      <div className="flex-1 px-2 pt-3 pb-2 sm:px-3" style={{ minHeight: height }}>
        {error ? (
          <ErrorBlock error={error} onRetry={onRetry} />
        ) : loading ? (
          <div role="status" aria-label={t('common.loading')} className="flex h-full flex-col justify-end gap-2 px-2 pb-2" style={{ height }}>
            {[0.55, 0.8, 0.4, 0.7, 0.9, 0.6].map((w, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-skeleton motion-reduce:animate-none" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted" style={{ height }}>
            <BarChart3 aria-hidden className="size-5" />
            {t('dashboard.charts.empty')}
          </div>
        ) : asTable && table ? (
          <div className="overflow-auto px-2" style={{ maxHeight: height + 40 }}>
            <table className="w-full text-sm">
              <caption className="sr-only">{t('dashboard.charts.tableCaption', { title })}</caption>
              <thead>
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={cn('border-b border-line py-2 text-xs font-medium text-muted', i ? 'text-end' : 'text-start')}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} className={cn('border-b border-line py-1.5 tabular-nums', ci ? 'text-end' : 'text-start')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <figure className="m-0" aria-label={summary ?? title}>
            {children}
          </figure>
        )}
      </div>
      {recordsHref && (
        <footer className="flex justify-end border-t border-line px-4 py-2 sm:px-5">
          <Link to={recordsHref} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline sm:min-h-0">
            {t('dashboard.openRecords')}
          </Link>
        </footer>
      )}
    </section>
  )
}

export function LegendKey({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg aria-hidden width="16" height="8" className="shrink-0">
            {i.dashed ? (
              <line x1="0" y1="4" x2="16" y2="4" stroke={i.color} strokeWidth="2" strokeDasharray="4 3" />
            ) : (
              <rect x="0" y="1" width="16" height="6" rx="3" fill={i.color} />
            )}
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** A small two-option toggle used in chart headers. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-subtle p-0.5 ring-1 ring-line ring-inset">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 rounded-[5px] px-2.5 text-xs font-medium transition-colors sm:min-h-7',
            value === o.value ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

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

/**
 * Frame for every chart: a 14px title that links to the records, a muted scope ("by month"),
 * an inline legend, and a table view. No footer: the title is the link.
 */
export function ChartCard({
  title,
  scope,
  controls,
  legend,
  loading,
  error,
  onRetry,
  empty,
  recordsHref,
  table,
  summary,
  height = 280,
  children,
  className,
  bleed = true,
}: {
  title: string
  scope?: string
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
  /** Charts bleed to 12px from the edges; tables sit flush. */
  bleed?: boolean
}) {
  const [asTable, setAsTable] = useState(false)
  const titleId = `chart-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={titleId} className={cn('card-flat flex min-w-0 flex-col', className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 pt-3.5 pb-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={titleId} className="text-title text-fg">
            {recordsHref ? (
              <Link to={recordsHref} className="rounded-sm hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
          {scope && <span className="text-caption text-muted">{scope}</span>}
        </div>
        <div className="flex items-center gap-2">
          {legend && !empty && !loading && legend}
          {controls}
          {table && !empty && !loading && (
            <button
              type="button"
              aria-pressed={asTable}
              aria-label={asTable ? t('dashboard.charts.showChart') : t('dashboard.charts.showTable')}
              title={asTable ? t('dashboard.charts.showChart') : t('dashboard.charts.showTable')}
              onClick={() => setAsTable((v) => !v)}
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg sm:size-6"
            >
              {asTable ? <BarChart3 aria-hidden className="size-3.5" /> : <Table2 aria-hidden className="size-3.5" />}
            </button>
          )}
        </div>
      </header>
      <div className={cn('flex-1', bleed ? 'px-3 pb-3' : 'pb-1')} style={{ minHeight: height }}>
        {error ? (
          <ErrorBlock error={error} onRetry={onRetry} />
        ) : loading ? (
          <div role="status" aria-label={t('common.loading')} className="flex h-full flex-col justify-end gap-2 px-2 pb-2" style={{ height }}>
            {[0.55, 0.8, 0.4, 0.7, 0.9, 0.6].map((w, i) => (
              <div key={i} className="h-2 animate-pulse rounded-sm bg-skeleton motion-reduce:animate-none" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        ) : empty ? (
          <div className="flex h-full flex-col justify-end px-2 pb-3 text-body text-muted" style={{ minHeight: Math.min(height, 120) }}>
            {t('dashboard.charts.empty')}
          </div>
        ) : asTable && table ? (
          <div className="overflow-auto px-1" style={{ maxHeight: height + 40 }}>
            <table className="w-full text-body">
              <caption className="sr-only">{t('dashboard.charts.tableCaption', { title })}</caption>
              <thead>
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={cn('border-b border-line py-1.5 text-caption font-medium text-muted', i ? 'text-end' : 'text-start')}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} className={cn('h-8 border-b border-line py-1', ci ? 'num text-end' : 'text-start')}>
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
    </section>
  )
}

export function LegendKey({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** A small two-option toggle used in chart headers. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-7 rounded-md border border-line bg-surface p-0.5 sm:h-6">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-[4px] px-2 text-[0.75rem] font-medium transition-colors', value === o.value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

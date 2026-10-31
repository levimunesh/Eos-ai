import { CircleAlert, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relativeTime } from '@/features/imports/format'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { changeTone, formatKpiValue } from './kpi-format'
import { compactNumber, formatChange, formatCount, formatRatio } from './money'
import { Sparkline } from './Sparkline'
import type { Kpi } from './types'

/** ▲12.5% as coloured text: good/bad colour applies only here, never to a series. */
export function Delta({ kpi, withPrevious = false, className }: { kpi: Kpi; withPrevious?: boolean; className?: string }) {
  const { dir, tone } = changeTone(kpi.key, kpi.change_pct)
  if (!dir) return <span className={cn('text-caption text-muted', className)}>{t('dashboard.noChange')}</span>
  const pct = formatChange(kpi.change_pct!)
  const label = dir === 'up' ? t('dashboard.up', { pct }) : dir === 'down' ? t('dashboard.down', { pct }) : t('dashboard.flat')
  const glyph = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 text-[0.75rem] leading-4', className)}>
      <span
        data-tone={tone}
        aria-label={label}
        title={label}
        className={cn('num font-semibold', tone === 'good' && 'text-success', tone === 'bad' && 'text-danger-text', tone === 'neutral' && 'text-muted')}
      >
        <span aria-hidden className="me-0.5 text-[0.625rem]">{glyph}</span>
        {dir === 'flat' ? '0.0%' : pct}
      </span>
      {withPrevious && kpi.previous_value !== null && (
        <span className="num text-muted">
          {t('dashboard.vsShort', { value: kpi.unit === 'ratio' ? formatRatio(kpi.previous_value) : compactNumber(Number(kpi.previous_value)) })}
        </span>
      )}
    </span>
  )
}

function coverageLine(kpi: Kpi): string {
  const pct = formatRatio(kpi.coverage_pct)
  return ['cogs', 'gross_profit', 'gross_margin'].includes(kpi.key) ? t('dashboard.coverageCost', { pct }) : t('dashboard.coverageGeneric', { pct })
}

export function DetailsBody({ kpi, now }: { kpi: Kpi; now: number }) {
  return (
    <div className="flex flex-col gap-3 text-body">
      {kpi.status === 'partial' && (
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 font-medium text-warning">
            <CircleAlert aria-hidden className="size-3.5" />
            {t('dashboard.partialTitle')}
          </p>
          <p className="text-fg-2">{coverageLine(kpi)}</p>
        </div>
      )}
      {kpi.notes.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 ps-4 text-fg-2">
          {kpi.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <dl className="flex flex-col gap-1 border-t border-line pt-2.5 text-caption">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.sources')}</dt>
          <dd className="text-end">{kpi.sources.map((s) => t(`dashboard.sourceNames.${s}` as StringKey)).join(', ')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.records')}</dt>
          <dd className="mono">{formatCount(kpi.row_count)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.lastImport')}</dt>
          <dd className="text-end">{kpi.last_import_at ? t('dashboard.updated', { when: relativeTime(kpi.last_import_at, now) }) : t('dashboard.neverImported')}</dd>
        </div>
      </dl>
    </div>
  )
}

/** The small status glyph for a partial figure: a triangle, not a pill. Opens the coverage note. */
export function PartialGlyph({ kpi, now }: { kpi: Kpi; now: number }) {
  return (
    <Popover>
      <PopoverTrigger
        className="relative z-10 inline-flex size-5 items-center justify-center rounded-sm text-warning hover:bg-warning-soft"
        aria-label={`${t('dashboard.partial')}: ${coverageLine(kpi)}`}
      >
        <svg aria-hidden viewBox="0 0 10 10" className="size-2.5" fill="currentColor">
          <path d="M5 1 9.5 9h-9z" />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end">
        <DetailsBody kpi={kpi} now={now} />
      </PopoverContent>
    </Popover>
  )
}

/** Display value with the currency code set small and muted on the baseline. */
export function Money({ value, unit, currency, decimals, size }: { value: Kpi['value']; unit: Kpi['unit']; currency: string; decimals: number; size: 'display' | 'kpi' }) {
  const text = formatKpiValue({ unit, value }, currency, decimals)
  if (text === null) return <span className={cn('num text-muted', size === 'display' ? 'text-display' : 'text-kpi')}>—</span>
  const [ccy, ...rest] = unit === 'money' ? text.split(' ') : [null]
  const amount = unit === 'money' ? rest.join(' ') : text
  return (
    <span className={cn('inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-fg', size === 'display' ? 'text-display' : 'text-kpi')}>
      {ccy && <span className="text-[0.8125rem] leading-4 font-medium tracking-normal text-muted">{ccy}</span>}
      <span className="num break-words">{amount}</span>
    </span>
  )
}

export function KpiCard({
  kpi,
  currency,
  decimals,
  hero = false,
  extra,
  onOpen,
  now,
  sparkline,
}: {
  kpi: Kpi
  currency: string
  decimals: number
  hero?: boolean
  extra?: ReactNode
  onOpen?: () => void
  now: number
  sparkline?: number[]
}) {
  const value = formatKpiValue(kpi, currency, decimals)
  const reason = kpi.status === 'no_data' ? t('dashboard.nullNoData') : t('dashboard.nullUncomputable')

  return (
    <div
      data-testid={`kpi-${kpi.key}`}
      className={cn('card-flat group/kpi relative flex min-w-0 flex-col gap-1 p-4', onOpen && 'transition-colors hover:border-line-strong', hero && 'gap-2')}
    >
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-body text-fg-2">
          {onOpen ? (
            <button type="button" onClick={onOpen} className="text-start after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:shadow-[0_0_0_2px_var(--ring)]">
              {kpi.label}
            </button>
          ) : (
            kpi.label
          )}
          {kpi.status === 'partial' && <PartialGlyph kpi={kpi} now={now} />}
        </h3>
        {sparkline && value !== null && <Sparkline values={sparkline} className="ms-auto shrink-0" />}
        <Popover>
          <PopoverTrigger
            aria-label={t('dashboard.details', { label: kpi.label })}
            className="relative z-10 -me-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted opacity-0 transition-opacity group-hover/kpi:opacity-100 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <Info aria-hidden className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end">
            <DetailsBody kpi={kpi} now={now} />
          </PopoverContent>
        </Popover>
      </div>

      {value === null ? (
        <p className="flex flex-col">
          <Money value={null} unit={kpi.unit} currency={currency} decimals={decimals} size={hero ? 'display' : 'kpi'} />
          <span className="text-caption text-muted">{reason}</span>
        </p>
      ) : (
        <p className="flex items-end justify-between gap-3">
          <Money value={kpi.value} unit={kpi.unit} currency={currency} decimals={decimals} size={hero ? 'display' : 'kpi'} />
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {value !== null && <Delta kpi={kpi} withPrevious={hero} />}
        {extra}
      </div>
    </div>
  )
}

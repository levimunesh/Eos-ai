import { ArrowDownRight, ArrowUpRight, CircleAlert, Info, Minus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relativeTime } from '@/features/imports/format'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { changeTone, formatKpiValue } from './kpi-format'
import { formatChange, formatCount, formatRatio } from './money'
import type { Kpi } from './types'

function ChangeBadge({ kpi }: { kpi: Kpi }) {
  const { dir, tone } = changeTone(kpi.key, kpi.change_pct)
  if (!dir) return <span className="text-xs text-muted">{t('dashboard.noChange')}</span>
  const pct = formatChange(kpi.change_pct!)
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  const label = dir === 'up' ? t('dashboard.up', { pct }) : dir === 'down' ? t('dashboard.down', { pct }) : t('dashboard.flat')
  return (
    <span
      data-tone={tone}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        tone === 'good' && 'bg-success-soft text-success',
        tone === 'bad' && 'bg-danger-soft text-danger-text',
        tone === 'neutral' && 'bg-subtle text-muted',
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      {dir === 'flat' ? '0.0%' : pct}
    </span>
  )
}

function coverageLine(kpi: Kpi): string {
  const pct = formatRatio(kpi.coverage_pct)
  return ['cogs', 'gross_profit', 'gross_margin'].includes(kpi.key)
    ? t('dashboard.coverageCost', { pct })
    : t('dashboard.coverageGeneric', { pct })
}

function DetailsBody({ kpi, now }: { kpi: Kpi; now: number }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      {kpi.status === 'partial' && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 font-medium text-warning">
            <CircleAlert aria-hidden className="size-4" />
            {t('dashboard.partialTitle')}
          </p>
          <p className="text-fg-2">{coverageLine(kpi)}</p>
          {kpi.notes.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 ps-4 text-fg-2">
              {kpi.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {kpi.status !== 'partial' && kpi.notes.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 ps-4 text-fg-2">
          {kpi.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.sources')}</dt>
          <dd className="text-end">
            {kpi.sources.map((s) => t(`dashboard.sourceNames.${s}` as StringKey)).join(', ')}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.records')}</dt>
          <dd className="tabular-nums">{formatCount(kpi.row_count)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('dashboard.lastImport')}</dt>
          <dd className="text-end">
            {kpi.last_import_at ? t('dashboard.updated', { when: relativeTime(kpi.last_import_at, now) }) : t('dashboard.neverImported')}
          </dd>
        </div>
      </dl>
    </div>
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
}: {
  kpi: Kpi
  currency: string
  decimals: number
  hero?: boolean
  extra?: React.ReactNode
  onOpen?: () => void
  now: number
}) {
  const value = formatKpiValue(kpi, currency, decimals)
  const reason = kpi.status === 'no_data' ? t('dashboard.nullNoData') : t('dashboard.nullUncomputable')
  const [ccy, ...rest] = value && kpi.unit === 'money' ? value.split(' ') : [null]
  const amount = value && kpi.unit === 'money' ? rest.join(' ') : value

  return (
    <div
      data-testid={`kpi-${kpi.key}`}
      className={cn(
        'surface-raised group/kpi relative flex min-w-0 flex-col gap-2 rounded-xl p-3.5 sm:p-4',
        onOpen && 'transition-colors hover:border-line-strong',
        hero && 'gap-2.5 sm:p-5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[0.8125rem] font-medium text-fg-2">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-start after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:shadow-[0_0_0_2px_var(--ring)]"
            >
              {kpi.label}
            </button>
          ) : (
            kpi.label
          )}
        </h3>
        <div className="relative z-10 flex items-center gap-1">
          {kpi.status === 'partial' && (
            <Popover>
              <PopoverTrigger
                className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-2xs font-medium text-warning"
                aria-label={`${t('dashboard.partial')}: ${coverageLine(kpi)}`}
              >
                <CircleAlert aria-hidden className="size-3" />
                {t('dashboard.partial')}
              </PopoverTrigger>
              <PopoverContent align="end">
                <DetailsBody kpi={kpi} now={now} />
              </PopoverContent>
            </Popover>
          )}
          <Popover>
            <PopoverTrigger
              aria-label={t('dashboard.details', { label: kpi.label })}
              className="-me-1.5 -mt-1 flex size-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
            >
              <Info aria-hidden className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="end">
              <DetailsBody kpi={kpi} now={now} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {value === null ? (
        <p className="flex flex-col">
          <span className={cn('font-semibold tracking-tight text-muted', hero ? 'text-3xl' : 'text-2xl')} aria-hidden>
            {'—'}
          </span>
          <span className="text-xs text-muted">{reason}</span>
        </p>
      ) : (
        <p className={cn('flex flex-wrap items-baseline gap-x-1.5 font-semibold tracking-tight text-fg', hero ? 'text-[1.75rem] leading-tight sm:text-[2rem]' : 'text-base leading-tight sm:text-xl')}>
          {ccy && <span className={cn('font-medium text-muted', hero ? 'text-sm' : 'text-xs')}>{ccy}</span>}
          <span className="min-w-0 break-words">{amount}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
        {value !== null && <ChangeBadge kpi={kpi} />}
        {extra}
      </div>
    </div>
  )
}

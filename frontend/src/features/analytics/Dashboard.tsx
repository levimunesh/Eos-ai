import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorBlock } from '@/components/states'
import { relativeTime } from '@/features/imports/format'
import { useOrgQuery, useBranchesQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useBreakdown, useInsights, useKpis } from './api'
import { buildAttention } from './attention'
import { BranchTable, CategoryTable, HeroTrend, LegendKey, ProductsTable, type ChartContext } from './Charts'
import { useTrendSeries } from './trend'
import { addDays, monthKey, monthRange } from './dates'
import { FilterBar } from './FilterBar'
import { useFilters } from './filters'
import { buildInsight } from './insight'
import { InsightStrip } from './InsightStrip'
import { Delta, KpiCard, Money, PartialGlyph } from './KpiCard'
import { allNoData } from './kpi-format'
import { formatDecimal, formatRatio } from './money'
import { SALES_KPIS, type Insight, type Kpi, type KpiKey } from './types'

const CHANGED: KpiKey[] = ['gross_sales', 'discounts', 'returns', 'gross_profit', 'cogs', 'transactions', 'avg_ticket']
const STRIP: KpiKey[] = ['gross_profit', 'transactions', 'avg_ticket', 'operating_expenses', 'inventory_value']
const ATTENTION_KINDS = new Set(['unusual_day', 'branch_lagging', 'missing_costs', 'missing_fx'])
const STRIP_KINDS = new Set(['headline_change', 'margin_pressure'])

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return monthName.format(new Date(Date.UTC(y, m - 1, 1)))
}

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden style={style} className={cn('animate-pulse rounded-sm bg-skeleton motion-reduce:animate-none', className)} />
}

function KpiSkeleton({ hero }: { hero?: boolean }) {
  return (
    <div aria-hidden className="card-flat flex flex-col gap-2 p-4">
      <Shimmer className="h-3 w-20" />
      <Shimmer className={hero ? 'h-9 w-44' : 'h-6 w-28'} />
      <Shimmer className="h-3 w-12" />
    </div>
  )
}

/** Signed absolute change, in the KPI's unit, compact. */
function absChange(k: Kpi, decimals: number): string | null {
  if (k.value === null || k.previous_value === null) return null
  const d = Number(k.value) - Number(k.previous_value)
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const a = Math.abs(d)
  if (k.unit === 'ratio') return `${sign}${(a * 100).toFixed(1)} pp`
  if (k.unit === 'count') return `${sign}${a.toLocaleString('en')}`
  const text = a >= 10_000 ? `${(a / 1000).toFixed(1)}k` : formatDecimal(a.toFixed(decimals), decimals)
  return `${sign}${text}`
}

function WhatChanged({ kpis, decimals, href, hasPrevious, now }: { kpis: Map<KpiKey, Kpi>; decimals: number; href: string; hasPrevious: boolean; now: number }) {
  return (
    <section aria-label={t('dashboard.whatChanged')} className="card-flat flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-title">{t('dashboard.whatChanged')}</h2>
        <span className="text-caption text-muted">{hasPrevious ? t('dashboard.whatChangedScope') : t('dashboard.noPrevious')}</span>
      </div>
      <ul className="mt-2 flex flex-1 flex-col divide-y divide-line">
        {CHANGED.map((key) => {
          const k = kpis.get(key)
          if (!k) return <li key={key} className="py-2.5"><Shimmer className="h-3 w-full" /></li>
          const abs = absChange(k, decimals)
          return (
            <li key={key} className="flex items-center gap-3 py-2 first:pt-1">
              <Link to={href} className="flex min-w-0 flex-1 items-center gap-1.5 text-body text-fg-2 hover:text-fg hover:underline">
                <span className="truncate">{k.label}</span>
                {k.status === 'partial' && <PartialGlyph kpi={k} now={now} />}
              </Link>
              {k.value === null ? (
                <span className="text-caption text-muted">—</span>
              ) : (
                <>
                  <Delta kpi={k} className="shrink-0" />
                  <span className="num w-16 shrink-0 text-end text-caption text-muted">{abs ?? ''}</span>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Attention({ items, href }: { items: Insight[]; href: string }) {
  if (!items.length) return null
  return (
    <section aria-label={t('dashboard.attention')} className="card-flat flex flex-col px-4 py-3">
      <h2 className="text-title">{t('dashboard.attention')}</h2>
      <ul className="mt-1.5 flex flex-col divide-y divide-line">
        {items.map((i) => {
          const fixable = i.kind === 'missing_costs' || i.kind === 'missing_fx'
          return (
            <li key={`${i.kind}-${i.text}`} className="flex items-start gap-2.5 py-2 text-body">
              <span
                aria-label={i.severity}
                className={cn('mt-2 size-1.5 shrink-0 rounded-full', i.severity === 'warning' ? 'bg-warning' : i.severity === 'notice' ? 'bg-accent' : 'bg-muted')}
              />
              <span className="min-w-0 flex-1 text-fg-2">{i.text}</span>
              {fixable ? (
                <Link to="/imports/new" className="shrink-0 text-body font-medium text-accent-text hover:underline">
                  {t('dashboard.fix')} <span aria-hidden>→</span>
                </Link>
              ) : i.kind === 'unusual_day' && typeof i.figures.date === 'string' ? (
                <Link to={`${href.split('?')[0]}?period=custom&from=${i.figures.date}&to=${i.figures.date}`} className="mono shrink-0 text-muted hover:underline">
                  {i.figures.date}
                </Link>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * The live dashboard. Renders `empty` instead when nothing in the chosen (or fallback)
 * period has data, so a new organisation never sees zeros dressed up as results.
 */
export function Dashboard({ empty }: { empty: React.ReactNode }) {
  const org = useOrgQuery()
  const branches = useBranchesQuery()
  const { filters, update, today, carry } = useFilters(org.data?.timezone)
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())

  // Latest month with sales, used when the default "this month" has nothing yet.
  const months = useBreakdown(
    // The API allows at most 3 x 366 days per request.
    { from: addDays(today, -3 * 365), to: today, branchIds: filters.branchIds, dimension: 'month', order: 'key', limit: 1000 },
    filters.isDefault,
  )
  const latestMonth = months.data?.rows.filter((r) => Number(r.net_sales) !== 0 || r.transactions > 0).at(-1)?.key
  const currentMonth = monthKey(today)
  const fallback = filters.isDefault && months.isSuccess && latestMonth && latestMonth < currentMonth ? latestMonth : null
  const waitingForFallback = filters.isDefault && months.isPending

  const range = useMemo(
    () => (fallback ? { ...monthRange(fallback), branchIds: filters.branchIds } : { from: filters.from, to: filters.to, branchIds: filters.branchIds }),
    [fallback, filters.from, filters.to, filters.branchIds],
  )
  const kpis = useKpis({ ...range, compare: filters.compare }, !waitingForFallback)
  const insights = useInsights(range, !waitingForFallback)

  const byKey = useMemo(() => new Map((kpis.data?.kpis ?? []).map((k) => [k.key, k] as const)), [kpis.data])
  const currency = kpis.data?.currency ?? org.data?.base_currency ?? ''
  const decimals = kpis.data?.currency_decimals ?? org.data?.currency_decimals ?? 2

  const recordsHref = (extra?: Record<string, string>) => {
    const p = new URLSearchParams(carry)
    if (fallback) {
      p.set('period', 'custom')
      p.set('from', range.from)
      p.set('to', range.to)
    }
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v)
    const q = p.toString()
    return `/records/sales${q ? `?${q}` : ''}`
  }

  const previous = filters.compare ? (kpis.data?.previous_period ?? null) : null
  const ctx: ChartContext = { range, previous, currency, decimals, recordsHref }
  const trend = useTrendSeries(ctx)
  const branchNow = useBreakdown({ ...range, dimension: 'branch', order: 'net', limit: 50 })
  const branchPrev = useBreakdown({ from: previous?.from ?? range.from, to: previous?.to ?? range.to, branchIds: range.branchIds, dimension: 'branch', order: 'net', limit: 50 }, !!previous)

  // Server insights, with a client-computed fallback built only from figures already on the page.
  const serverInsights = insights.data?.insights
  const fallbackInsight = useMemo(
    () => (!serverInsights && kpis.data ? buildInsight({ kpis: kpis.data, branches: branchNow.data?.rows ?? [], previousBranches: branchPrev.data?.rows ?? [] }) : null),
    [serverInsights, kpis.data, branchNow.data, branchPrev.data],
  )
  const stripInsights = serverInsights ? serverInsights.filter((i) => STRIP_KINDS.has(i.kind)) : fallbackInsight ? [fallbackInsight] : []
  const attention = serverInsights
    ? serverInsights.filter((i) => ATTENTION_KINDS.has(i.kind))
    : insights.isError
      ? buildAttention(kpis.data, trend.data, trend.byDay, currency, decimals)
      : []

  // With no data at all (nothing in the fallback search either), show the onboarding empty state.
  const noDataAnywhere = filters.isDefault && months.isSuccess && !latestMonth
  if (noDataAnywhere || (filters.isDefault && !fallback && allNoData(kpis.data) && !kpis.isPlaceholderData)) {
    return <>{empty}</>
  }

  const periodEmpty = allNoData(kpis.data)
  const net = byKey.get('net_sales')
  const partialCount = (kpis.data?.kpis ?? []).filter((k) => k.status === 'partial').length
  const lastImport = (kpis.data?.kpis ?? []).map((k) => k.last_import_at).filter(Boolean).sort().at(-1) ?? null
  const sparkFor = (key: KpiKey): number[] | undefined => {
    if (trend.data.length < 2) return undefined
    if (key === 'transactions') return trend.data.map((d) => d.tx)
    if (key === 'gross_profit') return trend.data.map((d) => d.gp)
    if (key === 'avg_ticket') return trend.data.map((d) => (d.tx ? d.current / d.tx : 0))
    if (key === 'net_sales') return trend.data.map((d) => d.current)
    return undefined
  }

  const card = (key: KpiKey) => {
    const k = byKey.get(key)
    if (!k) return <KpiSkeleton key={key} />
    let extra: React.ReactNode
    if (key === 'gross_profit') {
      const m = byKey.get('gross_margin')
      if (m?.value != null) extra = <span className="num text-caption text-muted">{t('dashboard.margin', { pct: formatRatio(m.value) })}</span>
    }
    return (
      <KpiCard
        key={key}
        kpi={k}
        currency={currency}
        decimals={decimals}
        extra={extra}
        now={now}
        sparkline={sparkFor(key)}
        onOpen={SALES_KPIS.includes(key) ? () => navigate(recordsHref()) : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        filters={fallback ? { ...filters, preset: 'custom', ...monthRange(fallback) } : filters}
        onChange={update}
        branches={branches.data ?? []}
        dateFormat={org.data?.date_format}
        meta={
          kpis.data && (
            <>
              {lastImport && <span>{t('dashboard.updated', { when: relativeTime(lastImport, now) })}</span>}
              {partialCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-warning" title={t('dashboard.partialTooltip')}>
                    <span aria-hidden className="text-[0.5625rem]">▲</span>
                    {t('dashboard.partialCount', { n: partialCount })}
                  </span>
                </>
              )}
            </>
          )
        }
      />

      {fallback && (
        <p role="status" className="flex items-start gap-2 text-caption text-muted">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {t('dashboard.fallbackNote', { current: monthLabel(currentMonth), month: monthLabel(fallback) })}
        </p>
      )}

      {kpis.isError ? (
        <div className="card-flat">
          <ErrorBlock error={kpis.error} onRetry={() => void kpis.refetch()} />
        </div>
      ) : periodEmpty ? (
        <div className="card-flat flex max-w-[60ch] flex-col items-start gap-1 px-4 py-8">
          <h2 className="text-[0.9375rem] font-semibold">{t('dashboard.noDataTitle')}</h2>
          <p className="text-body text-muted">{t('dashboard.noDataBody')}</p>
        </div>
      ) : (
        <>
          {stripInsights.length > 0 && <InsightStrip insights={stripInsights} rowCount={net?.row_count ?? null} fallback={!serverInsights} />}

          <section aria-label={t('dashboard.kpiGroup')} aria-busy={kpis.isFetching} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
            {net ? (
              <div data-testid="kpi-net_sales" className="card-flat flex min-w-0 flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h2 className="flex items-center gap-1.5 text-body text-fg-2">
                    <Link to={recordsHref()} className="hover:text-fg hover:underline">
                      {net.label}
                    </Link>
                    {net.status === 'partial' && <PartialGlyph kpi={net} now={now} />}
                    <span className="text-caption text-muted">{trend.byDay ? t('dashboard.charts.byDay') : t('dashboard.charts.byMonth')}</span>
                  </h2>
                  {trend.hasPrevious && (
                    <LegendKey
                      items={[
                        { label: t('dashboard.charts.current'), color: 'var(--chart-1)' },
                        { label: t('dashboard.charts.previous'), color: 'var(--chart-compare)' },
                      ]}
                    />
                  )}
                </div>
                <Money value={net.value} unit={net.unit} currency={currency} decimals={decimals} size="display" />
                <Delta kpi={net} withPrevious />
                <div className="-mx-1 mt-2">
                  {trend.loading ? (
                    <div role="status" aria-label={t('common.loading')} className="flex h-60 flex-col justify-end gap-2 px-2 pb-6">
                      {[0.55, 0.8, 0.4, 0.7].map((w, i) => (
                        <Shimmer key={i} className="h-2" style={{ width: `${w * 100}%` }} />
                      ))}
                    </div>
                  ) : trend.error ? (
                    <ErrorBlock error={trend.error} onRetry={() => void trend.refetch()} />
                  ) : trend.data.length > 1 ? (
                    <figure className="m-0" aria-label={t('dashboard.charts.summaryTrend', { from: range.from, to: range.to, n: trend.data.length, max: '', maxAt: '' }).replace(/ Highest.*$/, '')}>
                      <HeroTrend ctx={ctx} data={trend.data} hasPrevious={trend.hasPrevious} byDay={trend.byDay} />
                    </figure>
                  ) : null}
                </div>
              </div>
            ) : (
              <KpiSkeleton hero />
            )}
            <WhatChanged kpis={byKey as Map<KpiKey, Kpi>} decimals={decimals} href={recordsHref()} hasPrevious={!!previous} now={now} />
          </section>

          <section aria-label={t('dashboard.secondaryGroup')} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {STRIP.map(card)}
          </section>

          <Attention items={attention} href={recordsHref()} />

          <div className="grid items-start gap-3 lg:grid-cols-2">
            <BranchTable ctx={ctx} />
            <CategoryTable ctx={ctx} />
          </div>
          <ProductsTable ctx={ctx} />
        </>
      )}
    </div>
  )
}

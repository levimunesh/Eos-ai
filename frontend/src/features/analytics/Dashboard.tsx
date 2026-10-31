import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ErrorBlock } from '@/components/states'
import { useOrgQuery, useBranchesQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useBreakdown, useKpis } from './api'
import { BranchChart, CategoryChart, ProductsChart, TrendChart, type ChartContext } from './Charts'
import { addDays, monthKey, monthRange } from './dates'
import { FilterBar } from './FilterBar'
import { useFilters } from './filters'
import { KpiCard } from './KpiCard'
import { allNoData } from './kpi-format'
import { formatRatio } from './money'
import { SALES_KPIS, type Kpi, type KpiKey } from './types'

const HERO: KpiKey[] = ['net_sales', 'gross_profit', 'transactions', 'avg_ticket']
const SECONDARY: KpiKey[] = ['gross_sales', 'discounts', 'returns', 'operating_expenses', 'inventory_value', 'cogs']

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return monthName.format(new Date(Date.UTC(y, m - 1, 1)))
}

function KpiSkeleton({ hero }: { hero?: boolean }) {
  return (
    <div aria-hidden className="surface-raised flex flex-col gap-3 rounded-xl p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-skeleton motion-reduce:animate-none" />
      <div className={`${hero ? 'h-8 w-40' : 'h-6 w-32'} animate-pulse rounded bg-skeleton motion-reduce:animate-none`} />
      <div className="h-4 w-16 animate-pulse rounded-full bg-skeleton motion-reduce:animate-none" />
    </div>
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

  // With no data at all (nothing in the fallback search either), show the onboarding empty state.
  const noDataAnywhere = filters.isDefault && months.isSuccess && !latestMonth
  if (noDataAnywhere || (filters.isDefault && !fallback && allNoData(kpis.data) && !kpis.isPlaceholderData)) {
    return <>{empty}</>
  }

  const ctx: ChartContext = {
    range,
    previous: filters.compare ? (kpis.data?.previous_period ?? null) : null,
    currency,
    decimals,
    recordsHref,
  }

  const card = (key: KpiKey, hero = false) => {
    const k = byKey.get(key)
    if (!k) return <KpiSkeleton key={key} hero={hero} />
    let extra: React.ReactNode
    if (key === 'gross_profit') {
      const m = byKey.get('gross_margin')
      if (m?.value != null) extra = <span className="text-xs text-muted tabular-nums">{t('dashboard.margin', { pct: formatRatio(m.value) })}</span>
    }
    return (
      <KpiCard
        key={key}
        kpi={k as Kpi}
        currency={currency}
        decimals={decimals}
        hero={hero}
        extra={extra}
        now={now}
        onOpen={SALES_KPIS.includes(key) ? () => navigate(recordsHref()) : undefined}
      />
    )
  }

  const periodEmpty = allNoData(kpis.data)

  return (
    <div className="flex flex-col gap-5">
      <FilterBar filters={fallback ? { ...filters, preset: 'custom', ...monthRange(fallback) } : filters} onChange={update} branches={branches.data ?? []} dateFormat={org.data?.date_format} />

      {fallback && (
        <p role="status" className="flex items-start gap-2 text-xs text-muted">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {t('dashboard.fallbackNote', { current: monthLabel(currentMonth), month: monthLabel(fallback) })}
        </p>
      )}

      {kpis.isError ? (
        <div className="surface-raised rounded-xl">
          <ErrorBlock error={kpis.error} onRetry={() => void kpis.refetch()} />
        </div>
      ) : periodEmpty ? (
        <div className="surface-raised flex flex-col items-center gap-1 rounded-xl px-6 py-14 text-center">
          <h2 className="text-[0.9375rem] font-semibold">{t('dashboard.noDataTitle')}</h2>
          <p className="max-w-sm text-sm text-muted">{t('dashboard.noDataBody')}</p>
        </div>
      ) : (
        <>
          <section aria-label={t('dashboard.kpiGroup')} className="flex flex-col gap-3" aria-busy={kpis.isFetching}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{HERO.map((k) => card(k, true))}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{SECONDARY.map((k) => card(k))}</div>
          </section>

          <TrendChart ctx={ctx} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <BranchChart ctx={ctx} />
            <CategoryChart ctx={ctx} />
          </div>
          <ProductsChart ctx={ctx} />
        </>
      )}
    </div>
  )
}

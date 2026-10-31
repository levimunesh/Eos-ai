import { useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { t } from '@/lib/strings'
import { useBreakdown, type RangeParams } from './api'
import { ChartCard, LegendKey, Segmented } from './ChartCard'
import { addDays, daysBetween } from './dates'
import { compactNumber, formatCount, formatDecimal, formatRatio } from './money'
import type { BreakdownRow } from './types'

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 }
const C1 = 'var(--chart-1)'
const C2 = 'var(--chart-2)'
const CMP = 'var(--chart-compare)'

interface Ctx {
  range: RangeParams
  previous: { from: string; to: string } | null
  currency: string
  decimals: number
  recordsHref: (extra?: Record<string, string>) => string
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-fg">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-2">
              <svg aria-hidden width="10" height="10">
                {r.dashed ? (
                  <line x1="0" y1="5" x2="10" y2="5" stroke={r.color} strokeWidth="2" strokeDasharray="3 2" />
                ) : (
                  <rect width="10" height="10" rx="2" fill={r.color} />
                )}
              </svg>
              {r.label}
            </span>
            <span className="font-medium text-fg tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Fills missing days/months with zero so the line doesn't skip gaps. */
function series(rows: BreakdownRow[], from: string, to: string, byDay: boolean): { key: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.key, Number(r.net_sales)]))
  const out: { key: string; value: number }[] = []
  if (byDay) {
    const n = daysBetween(from, to)
    for (let i = 0; i < n; i++) {
      const k = addDays(from, i)
      out.push({ key: k, value: map.get(k) ?? 0 })
    }
  } else {
    let k = from.slice(0, 7)
    const end = to.slice(0, 7)
    while (k <= end) {
      out.push({ key: k, value: map.get(k) ?? 0 })
      const [y, m] = k.split('-').map(Number)
      k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    }
  }
  return out
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
function keyLabel(k: string, byDay: boolean): string {
  const [y, m, d] = k.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d || 1))
  return byDay ? dayFmt.format(date) : monthFmt.format(date)
}

export function TrendChart({ ctx }: { ctx: Ctx }) {
  const { range, previous, currency, decimals } = ctx
  const byDay = daysBetween(range.from, range.to) <= 62
  const dimension = byDay ? 'day' : 'month'
  const cur = useBreakdown({ ...range, dimension, order: 'key', limit: 1000 })
  const prev = useBreakdown(
    { from: previous?.from ?? range.from, to: previous?.to ?? range.to, branchIds: range.branchIds, dimension, order: 'key', limit: 1000 },
    !!previous,
  )

  const data = useMemo(() => {
    if (!cur.data) return []
    const a = series(cur.data.rows, range.from, range.to, byDay)
    // No previous rows at all means nothing was imported for that period: draw no line rather than a fake zero.
    const b = previous && prev.data && prev.data.rows.length ? series(prev.data.rows, previous.from, previous.to, byDay) : []
    return a.map((p, i) => ({ key: p.key, label: keyLabel(p.key, byDay), current: p.value, previous: b[i]?.value ?? null, prevKey: b[i]?.key ?? null }))
  }, [cur.data, prev.data, range.from, range.to, previous, byDay])

  const hasPrevious = !!previous && data.some((d) => d.previous !== null)
  const total = data.reduce((s, d) => s + d.current, 0)
  const empty = !cur.isPending && total === 0
  const max = data.reduce((m, d) => (d.current > m.current ? d : m), data[0] ?? { current: 0, label: '' })
  const fmt = (v: number) => `${currency} ${formatDecimal(v.toFixed(decimals), decimals)}`

  return (
    <ChartCard
      title={t('dashboard.charts.trend')}
      subtitle={byDay ? t('dashboard.charts.trendByDay') : t('dashboard.charts.trendByMonth')}
      loading={cur.isPending}
      error={cur.error}
      onRetry={() => void cur.refetch()}
      empty={empty}
      recordsHref={ctx.recordsHref()}
      legend={
        hasPrevious ? (
          <LegendKey
            items={[
              { label: t('dashboard.charts.current'), color: C1 },
              { label: t('dashboard.charts.previous'), color: CMP, dashed: true },
            ]}
          />
        ) : undefined
      }
      summary={t('dashboard.charts.summaryTrend', { from: range.from, to: range.to, n: data.length, max: fmt(max.current), maxAt: max.label })}
      table={{
        columns: [t('dashboard.charts.period'), t('dashboard.charts.current'), ...(hasPrevious ? [t('dashboard.charts.previous')] : [])],
        rows: data.map((d) => [d.label, fmt(d.current), ...(hasPrevious ? [d.previous === null ? '–' : fmt(d.previous)] : [])]),
      }}
      height={260}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C1} stopOpacity={0.14} />
              <stop offset="100%" stopColor={C1} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} minTickGap={24} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compactNumber(v)} />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={(p: TooltipContentProps<ValueType, NameType>) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!p.active || !d) return null
              return (
                <TooltipBox
                  title={d.label}
                  rows={[
                    { label: t('dashboard.charts.current'), value: fmt(d.current), color: C1 },
                    ...(hasPrevious && d.previous !== null
                      ? [{ label: `${t('dashboard.charts.previous')} (${keyLabel(d.prevKey!, byDay)})`, value: fmt(d.previous), color: CMP, dashed: true }]
                      : []),
                  ]}
                />
              )
            }}
          />
          {hasPrevious && (
            <Line type="monotone" dataKey="previous" stroke={CMP} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          )}
          <Area
            type="monotone"
            dataKey="current"
            stroke={C1}
            strokeWidth={2}
            fill="url(#trend-fill)"
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function HBarChart({
  rows,
  bars,
  currency,
  decimals,
  labelWidth = 72,
  barSize = 12,
}: {
  rows: { label: string; full: string; values: number[]; meta?: string }[]
  bars: { label: string; color: string }[]
  currency: string
  decimals: number
  labelWidth?: number
  barSize?: number
}) {
  const fmt = (v: number) => `${currency} ${formatDecimal(v.toFixed(decimals), decimals)}`
  const data = rows.map((r) => ({ label: r.label, full: r.full, meta: r.meta, ...Object.fromEntries(r.values.map((v, i) => [`v${i}`, v])) }))
  const per = bars.length * (barSize + 2) + 14
  const height = Math.max(120, rows.length * per + 28)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap={12} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactNumber(v)} />
        <YAxis type="category" dataKey="label" tick={{ ...AXIS_TICK, fill: 'var(--fg-2)' }} tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} width={labelWidth} interval={0} />
        <Tooltip
          cursor={{ fill: 'var(--subtle)' }}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            const d = p.payload?.[0]?.payload as { full: string; meta?: string } & Record<string, number> | undefined
            if (!p.active || !d) return null
            return (
              <div>
                <TooltipBox title={d.full} rows={bars.map((b, i) => ({ label: b.label, value: fmt(d[`v${i}`] as number), color: b.color }))} />
                {d.meta && <p className="sr-only">{d.meta}</p>}
              </div>
            )
          }}
        />
        {bars.map((b, i) => (
          <Bar key={b.label} dataKey={`v${i}`} name={b.label} fill={b.color} barSize={barSize} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BranchChart({ ctx }: { ctx: Ctx }) {
  const q = useBreakdown({ ...ctx.range, dimension: 'branch', order: 'net', limit: 50 })
  const rows = q.data?.rows ?? []
  const fmt = (v: string) => `${ctx.currency} ${formatDecimal(v, ctx.decimals)}`
  const bars = [
    { label: t('dashboard.charts.netSales'), color: C1 },
    { label: t('dashboard.charts.grossProfit'), color: C2 },
  ]
  return (
    <ChartCard
      title={t('dashboard.charts.branches')}
      loading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isPending && rows.length === 0}
      recordsHref={ctx.recordsHref()}
      legend={<LegendKey items={bars} />}
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.branches'), n: rows.length, top: rows[0].label, value: fmt(rows[0].net_sales) }) : undefined}
      table={{
        columns: [t('dashboard.charts.branch'), t('dashboard.charts.netSales'), t('dashboard.charts.grossProfit'), t('dashboard.charts.costKnown')],
        rows: rows.map((r) => [r.label, fmt(r.net_sales), fmt(r.gross_profit), formatRatio(r.cost_coverage_pct)]),
      }}
      height={160}
    >
      <HBarChart
        rows={rows.map((r) => ({ label: r.label, full: `${r.label}, ${t('dashboard.charts.transactions', { n: formatCount(r.transactions) })}`, values: [Number(r.net_sales), Number(r.gross_profit)] }))}
        bars={bars}
        currency={ctx.currency}
        decimals={ctx.decimals}
        labelWidth={64}
        barSize={rows.length <= 4 ? 16 : 12}
      />
    </ChartCard>
  )
}

export function ProductsChart({ ctx }: { ctx: Ctx }) {
  const [order, setOrder] = useState<'net' | 'gross_profit'>('net')
  const q = useBreakdown({ ...ctx.range, dimension: 'product', order, limit: 10 })
  const rows = q.data?.rows ?? []
  const color = order === 'net' ? C1 : C2
  const label = order === 'net' ? t('dashboard.charts.netSales') : t('dashboard.charts.grossProfit')
  const fmt = (v: string) => `${ctx.currency} ${formatDecimal(v, ctx.decimals)}`
  const shortName = (r: BreakdownRow) => {
    const name = r.label.split(' · ').slice(1).join(' · ') || r.key
    return name.length > 22 ? `${name.slice(0, 21)}…` : name
  }
  return (
    <ChartCard
      title={t('dashboard.charts.products')}
      controls={
        <Segmented
          label={t('dashboard.charts.products')}
          value={order}
          onChange={setOrder}
          options={[
            { value: 'net', label: t('dashboard.charts.byNet') },
            { value: 'gross_profit', label: t('dashboard.charts.byProfit') },
          ]}
        />
      }
      loading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isPending && rows.length === 0}
      recordsHref={ctx.recordsHref()}
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.products'), n: rows.length, top: rows[0].label, value: fmt(order === 'net' ? rows[0].net_sales : rows[0].gross_profit) }) : undefined}
      table={{
        columns: [t('dashboard.charts.item'), t('dashboard.charts.netSales'), t('dashboard.charts.grossProfit')],
        rows: rows.map((r) => [r.label, fmt(r.net_sales), fmt(r.gross_profit)]),
      }}
      height={300}
    >
      <HBarChart
        rows={rows.map((r) => ({
          label: shortName(r),
          full: r.label,
          values: [Number(order === 'net' ? r.net_sales : r.gross_profit)],
        }))}
        bars={[{ label, color }]}
        currency={ctx.currency}
        decimals={ctx.decimals}
        labelWidth={132}
        barSize={14}
      />
    </ChartCard>
  )
}

export function CategoryChart({ ctx }: { ctx: Ctx }) {
  const q = useBreakdown({ ...ctx.range, dimension: 'category', order: 'net', limit: 12 })
  const rows = q.data?.rows ?? []
  const total = rows.reduce((s, r) => s + Number(r.net_sales), 0)
  const fmt = (v: string) => `${ctx.currency} ${formatDecimal(v, ctx.decimals)}`
  return (
    <ChartCard
      title={t('dashboard.charts.categories')}
      loading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isPending && rows.length === 0}
      recordsHref={ctx.recordsHref()}
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.categories'), n: rows.length, top: rows[0].label, value: fmt(rows[0].net_sales) }) : undefined}
      table={{
        columns: [t('dashboard.charts.item'), t('dashboard.charts.netSales'), t('dashboard.charts.share')],
        rows: rows.map((r) => [r.label, fmt(r.net_sales), total ? formatRatio(Number(r.net_sales) / total) : '–']),
      }}
      height={300}
    >
      {/* Ranked bars with the share printed beside each: easier to compare than a donut's arcs. */}
      <ul className="flex flex-col gap-3 px-2 pt-1 pb-2">
        {rows.map((r) => {
          const share = total ? Number(r.net_sales) / total : 0
          return (
            <li key={r.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-fg-2">{r.label}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  <span className="font-medium text-fg">{fmt(r.net_sales)}</span> {formatRatio(share)}
                </span>
              </div>
              <div aria-hidden className="h-2 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(1, share * 100)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </ChartCard>
  )
}

export type { Ctx as ChartContext }

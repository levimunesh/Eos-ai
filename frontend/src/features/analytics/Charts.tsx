import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useBreakdown, type RangeParams } from './api'
import { keyLabel, niceMax, type TrendPoint } from './trend'
import { ChartCard, LegendKey, Segmented } from './ChartCard'
import { compactNumber, formatCount, formatDecimal, formatRatio } from './money'
import type { BreakdownRow } from './types'

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }
const C1 = 'var(--chart-1)'
const CMP = 'var(--chart-compare)'

interface Ctx {
  range: RangeParams
  previous: { from: string; to: string } | null
  currency: string
  decimals: number
  recordsHref: (extra?: Record<string, string>) => string
}

export function TooltipBox({ title, rows, delta }: { title: string; rows: { label: string; value: string; color?: string }[]; delta?: { pct: number } }) {
  return (
    <div className="elev-raised min-w-40 rounded-lg px-3 py-2 text-caption">
      <p className="mono mb-1 text-fg">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-2">
              {r.color && <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="num font-medium text-fg">{r.value}</span>
          </li>
        ))}
        {delta && (
          <li className="mt-0.5 flex items-center justify-between gap-4 border-t border-line pt-1">
            <span className="text-muted">{t('dashboard.whatChangedScope')}</span>
            <span className={cn('num font-semibold', delta.pct > 0 ? 'text-success' : delta.pct < 0 ? 'text-danger-text' : 'text-muted')}>
              {delta.pct > 0 ? '▲' : delta.pct < 0 ? '▼' : '■'} {Math.abs(delta.pct * 100).toFixed(1)}%
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}

/** The hero line: 1.5px linear, comparison solid grey, three hairlines, last point labelled. */
export function HeroTrend({ ctx, data, hasPrevious, byDay, height = 240 }: { ctx: Ctx; data: TrendPoint[]; hasPrevious: boolean; byDay: boolean; height?: number }) {
  const { currency, decimals } = ctx
  const fmt = (v: number) => `${currency} ${formatDecimal(v.toFixed(decimals), decimals)}`
  const top = niceMax(Math.max(...data.map((d) => Math.max(d.current, d.previous ?? 0)), 0))
  const ticks = [0, top / 2, top]
  const lastIndex = data.length - 1
  const last = data[lastIndex]
  const lastDot = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props
    if (index !== lastIndex || cx === undefined || cy === undefined) return <g key={`d-${index}`} />
    const flip = cx > 0 && data.length > 2 && index === lastIndex
    return (
      <g key="last">
        <circle cx={cx} cy={cy} r={4} fill={C1} stroke="var(--surface)" strokeWidth={1.5} />
        <text x={flip ? cx - 8 : cx + 8} y={cy - 8} textAnchor={flip ? 'end' : 'start'} fontSize={11.5} fontFamily="var(--font-mono)" fill="var(--fg)">
          {compactNumber(last.current)}
        </text>
      </g>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" horizontalValues={ticks} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={28} interval="preserveStartEnd" />
        <YAxis domain={[0, top]} ticks={ticks} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => compactNumber(v)} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
          isAnimationActive={false}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            const d = p.payload?.[0]?.payload as TrendPoint | undefined
            if (!p.active || !d) return null
            const withPrev = hasPrevious && d.previous !== null
            return (
              <TooltipBox
                title={d.label}
                rows={[
                  { label: t('dashboard.charts.current'), value: fmt(d.current), color: C1 },
                  ...(withPrev ? [{ label: `${t('dashboard.charts.previous')} (${keyLabel(d.prevKey!, byDay)})`, value: fmt(d.previous!), color: CMP }] : []),
                ]}
                delta={withPrev && d.previous ? { pct: (d.current - d.previous) / d.previous } : undefined}
              />
            )
          }}
        />
        {hasPrevious && <Line type="linear" dataKey="previous" stroke={CMP} strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />}
        <Line
          type="linear"
          dataKey="current"
          stroke={C1}
          strokeWidth={1.5}
          dot={lastDot}
          activeDot={{ r: 3, fill: C1, stroke: 'var(--surface)', strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Right-aligned figure with a proportional bar behind it. The top row is the accent; the rest grey. */
function BarCell({ value, share, top, children }: { value: string; share: number; top?: boolean; children?: React.ReactNode }) {
  const style = { '--bar': `${Math.max(0, Math.min(1, share)) * 100}%`, '--bar-color': top ? 'var(--accent-soft)' : 'var(--chart-bar-bg)' } as CSSProperties
  return (
    <td className="bar-cell h-8 w-[1%] border-b border-line px-3 text-end whitespace-nowrap" style={style}>
      <span className={cn('num', top ? 'font-semibold text-fg' : 'text-fg')}>{value}</span>
      {children}
    </td>
  )
}

function Th({ children, end }: { children: React.ReactNode; end?: boolean }) {
  return (
    <th scope="col" className={cn('h-7 border-b border-line px-3 text-caption font-medium whitespace-nowrap text-muted', end ? 'text-end' : 'text-start')}>
      {children}
    </th>
  )
}

export function BranchTable({ ctx }: { ctx: Ctx }) {
  const q = useBreakdown({ ...ctx.range, dimension: 'branch', order: 'net', limit: 50 })
  const rows = q.data?.rows ?? []
  const max = Math.max(...rows.map((r) => Number(r.net_sales)), 0)
  const fmt = (v: string) => formatDecimal(v, ctx.decimals)
  return (
    <ChartCard
      title={t('dashboard.charts.branches')}
      scope={t('dashboard.charts.byBranch')}
      loading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isPending && rows.length === 0}
      recordsHref={ctx.recordsHref()}
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.branches'), n: rows.length, top: rows[0].label, value: `${ctx.currency} ${fmt(rows[0].net_sales)}` }) : undefined}
      height={140}
      bleed={false}
    >
      <table className="w-full">
        <thead>
          <tr>
            <Th>{t('dashboard.charts.branch')}</Th>
            <Th end>{t('dashboard.charts.colTransactions')}</Th>
            <Th end>{t('dashboard.charts.netCcy', { ccy: ctx.currency })}</Th>
            <Th end>{t('dashboard.charts.margin')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const margin = Number(r.net_sales) ? Number(r.gross_profit) / Number(r.net_sales) : 0
            return (
              <tr key={r.key} className="hover:bg-surface-2">
                <td className="h-8 border-b border-line px-3">
                  <Link to={ctx.recordsHref()} className="mono text-fg hover:underline">
                    {r.label}
                  </Link>
                </td>
                <td className="num h-8 w-[1%] border-b border-line px-3 text-end text-fg-2">{formatCount(r.transactions)}</td>
                <BarCell value={fmt(r.net_sales)} share={max ? Number(r.net_sales) / max : 0} top={i === 0} />
                <td className="num h-8 w-[1%] border-b border-line px-3 text-end whitespace-nowrap text-fg-2">
                  {formatRatio(margin)}
                  {Number(r.cost_coverage_pct) < 1 && (
                    <span className="ms-1 text-[0.5625rem] text-warning" title={t('dashboard.charts.costCoverage', { pct: formatRatio(r.cost_coverage_pct) })}>
                      ▲
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ChartCard>
  )
}

export function CategoryTable({ ctx }: { ctx: Ctx }) {
  const q = useBreakdown({ ...ctx.range, dimension: 'category', order: 'net', limit: 12 })
  const rows = q.data?.rows ?? []
  const total = rows.reduce((s, r) => s + Number(r.net_sales), 0)
  const max = Math.max(...rows.map((r) => Number(r.net_sales)), 0)
  const fmt = (v: string) => formatDecimal(v, ctx.decimals)
  return (
    <ChartCard
      title={t('dashboard.charts.categories')}
      scope={t('dashboard.charts.byCategory')}
      loading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isPending && rows.length === 0}
      recordsHref={ctx.recordsHref()}
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.categories'), n: rows.length, top: rows[0].label, value: `${ctx.currency} ${fmt(rows[0].net_sales)}` }) : undefined}
      height={140}
      bleed={false}
    >
      <table className="w-full">
        <thead>
          <tr>
            <Th>{t('dashboard.charts.category')}</Th>
            <Th end>{t('dashboard.charts.netCcy', { ccy: ctx.currency })}</Th>
            <Th end>{t('dashboard.charts.shareShort')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className="hover:bg-surface-2">
              <td className="h-8 border-b border-line px-3 text-fg-2">{r.label}</td>
              <BarCell value={fmt(r.net_sales)} share={max ? Number(r.net_sales) / max : 0} top={i === 0} />
              <td className="num h-8 w-[1%] border-b border-line px-3 text-end text-muted">{total ? formatRatio(Number(r.net_sales) / total) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}

export function ProductsTable({ ctx }: { ctx: Ctx }) {
  const [order, setOrder] = useState<'net' | 'gross_profit'>('net')
  const q = useBreakdown({ ...ctx.range, dimension: 'product', order, limit: 10 })
  const rows = q.data?.rows ?? []
  const pick = (r: BreakdownRow) => Number(order === 'net' ? r.net_sales : r.gross_profit)
  const max = Math.max(...rows.map(pick), 0)
  const fmt = (v: string) => formatDecimal(v, ctx.decimals)
  const split = (r: BreakdownRow) => {
    const i = r.label.indexOf(' · ')
    return i === -1 ? { sku: r.key, name: r.label } : { sku: r.label.slice(0, i), name: r.label.slice(i + 3) }
  }
  return (
    <ChartCard
      title={t('dashboard.charts.products')}
      scope={t('dashboard.charts.topTen')}
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
      summary={rows[0] ? t('dashboard.charts.summaryBars', { title: t('dashboard.charts.products'), n: rows.length, top: rows[0].label, value: `${ctx.currency} ${fmt(order === 'net' ? rows[0].net_sales : rows[0].gross_profit)}` }) : undefined}
      height={200}
      bleed={false}
    >
      <table className="w-full">
        <thead>
          <tr>
            <Th>{t('dashboard.charts.item')}</Th>
            <Th end>{t('dashboard.charts.netCcy', { ccy: ctx.currency })}</Th>
            <Th end>{t('dashboard.charts.profitCcy', { ccy: ctx.currency })}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const { sku, name } = split(r)
            const net = <BarCell key="n" value={fmt(r.net_sales)} share={order === 'net' && max ? Number(r.net_sales) / max : 0} top={order === 'net' && i === 0} />
            const gp = <BarCell key="g" value={fmt(r.gross_profit)} share={order === 'gross_profit' && max ? Number(r.gross_profit) / max : 0} top={order === 'gross_profit' && i === 0} />
            return (
              <tr key={r.key} className="hover:bg-surface-2">
                <td className="h-8 border-b border-line px-3">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="mono shrink-0 text-muted">{sku}</span>
                    <span className="text-fg">{name}</span>
                  </span>
                </td>
                {net}
                {gp}
              </tr>
            )
          })}
        </tbody>
      </table>
    </ChartCard>
  )
}

export { LegendKey }
export type { Ctx as ChartContext }

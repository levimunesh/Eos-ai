import { useMemo } from 'react'
import { useBreakdown, type RangeParams } from './api'
import { addDays, daysBetween } from './dates'
import type { BreakdownRow } from './types'

interface Ctx {
  range: RangeParams
  previous: { from: string; to: string } | null
}

/** Fills missing days/months with zero so the line doesn't skip gaps. */
function series(rows: BreakdownRow[], from: string, to: string, byDay: boolean): { key: string; row: BreakdownRow | null }[] {
  const map = new Map(rows.map((r) => [r.key, r]))
  const out: { key: string; row: BreakdownRow | null }[] = []
  if (byDay) {
    const n = daysBetween(from, to)
    for (let i = 0; i < n; i++) {
      const k = addDays(from, i)
      out.push({ key: k, row: map.get(k) ?? null })
    }
  } else {
    let k = from.slice(0, 7)
    const end = to.slice(0, 7)
    while (k <= end) {
      out.push({ key: k, row: map.get(k) ?? null })
      const [y, m] = k.split('-').map(Number)
      k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    }
  }
  return out
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
export function keyLabel(k: string, byDay: boolean): string {
  const [y, m, d] = k.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d || 1))
  return byDay ? dayFmt.format(date) : monthFmt.format(date)
}

/** Round up to a "nice" ceiling (1, 2, 2.5, 5 × 10^k) with 10% headroom. */
export function niceMax(max: number): number {
  if (max <= 0) return 1
  const target = max * 1.1
  const mag = 10 ** Math.floor(Math.log10(target))
  // Steps whose halves are also round, so the middle hairline reads cleanly (0 / 25K / 50K).
  for (const m of [1, 1.5, 2, 3, 4, 5, 10]) if (m * mag >= target) return m * mag
  return 10 * mag
}

export interface TrendPoint {
  key: string
  label: string
  current: number
  tx: number
  gp: number
  cogs: number
  previous: number | null
  prevKey: string | null
}

/** Current (and previous) period as a filled series, by day for short ranges and by month otherwise. */
export function useTrendSeries(ctx: Ctx) {
  const { range, previous } = ctx
  const byDay = daysBetween(range.from, range.to) <= 62
  const dimension = byDay ? 'day' : 'month'
  const cur = useBreakdown({ ...range, dimension, order: 'key', limit: 1000 })
  const prev = useBreakdown(
    { from: previous?.from ?? range.from, to: previous?.to ?? range.to, branchIds: range.branchIds, dimension, order: 'key', limit: 1000 },
    !!previous,
  )
  const data = useMemo<TrendPoint[]>(() => {
    if (!cur.data) return []
    const a = series(cur.data.rows, range.from, range.to, byDay)
    // No previous rows at all means nothing was imported for that period: draw no line rather than a fake zero.
    const b = previous && prev.data && prev.data.rows.length ? series(prev.data.rows, previous.from, previous.to, byDay) : []
    return a.map((p, i) => ({
      key: p.key,
      label: keyLabel(p.key, byDay),
      current: Number(p.row?.net_sales ?? 0),
      tx: p.row?.transactions ?? 0,
      gp: Number(p.row?.gross_profit ?? 0),
      cogs: Number(p.row?.cogs ?? 0),
      previous: b[i] ? Number(b[i].row?.net_sales ?? 0) : null,
      prevKey: b[i]?.key ?? null,
    }))
  }, [cur.data, prev.data, range.from, range.to, previous, byDay])
  const hasPrevious = !!previous && data.some((d) => d.previous !== null)
  return { data, byDay, hasPrevious, loading: cur.isPending, error: cur.error, refetch: cur.refetch }
}


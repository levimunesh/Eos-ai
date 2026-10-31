import { t } from '@/lib/strings'
import { formatCount, formatMoney, formatRatio } from './money'
import { UP_IS_BAD, type Kpi, type KpiResponse } from './types'

export function formatKpiValue(kpi: Pick<Kpi, 'unit' | 'value'>, currency: string, decimals: number): string | null {
  if (kpi.value === null || kpi.value === undefined) return null
  if (kpi.unit === 'money') return formatMoney(kpi.value, currency, decimals)
  if (kpi.unit === 'ratio') return formatRatio(kpi.value)
  return formatCount(kpi.value)
}

export type ChangeTone = 'good' | 'bad' | 'neutral'

/** Direction of change and whether that direction is good for this metric. */
export function changeTone(key: Kpi['key'], change: string | null): { dir: 'up' | 'down' | 'flat' | null; tone: ChangeTone } {
  if (change === null) return { dir: null, tone: 'neutral' }
  const n = Number(change)
  if (n === 0) return { dir: 'flat', tone: 'neutral' }
  const up = n > 0
  const bad = UP_IS_BAD.includes(key) ? up : !up
  return { dir: up ? 'up' : 'down', tone: bad ? 'bad' : 'good' }
}

export function allNoData(res: KpiResponse | undefined): boolean {
  return !!res && res.kpis.every((k) => k.status === 'no_data')
}

/** "rows 2–3", "rows 2, 4–5", "row 7". */
export function describeRows(rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b)
  if (sorted.length === 1) return t('records.row', { n: sorted[0] })
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (const n of [...sorted.slice(1), Infinity]) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`)
    start = prev = n
  }
  return t('records.rows', { list: parts.join(', ') })
}


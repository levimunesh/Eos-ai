import { describe, expect, it } from 'vitest'
import { kpiResponse } from './fixtures'
import { buildInsight, numbersIn } from './insight'
import type { BreakdownRow } from './types'

const row = (key: string, net: string): BreakdownRow => ({ key, label: key, net_sales: net, transactions: 100, qty: '0', cogs: '0', gross_profit: '0', cost_coverage_pct: '1' })
const now = [row('EOS-01', '20000.000'), row('EOS-02', '14000.000'), row('EOS-03', '6289.545')]
const prev = [row('EOS-01', '19000.000'), row('EOS-02', '10000.000'), row('EOS-03', '6520.000')]

/** Every number the inputs could legitimately contribute, formatted the way the sentence does. */
function allowed(kpis: ReturnType<typeof kpiResponse>, a: BreakdownRow[], b: BreakdownRow[]): Set<string> {
  const out = new Set<string>()
  const pct = (v: string | number) => `${(Math.abs(Number(v)) * 100).toFixed(1)}%`
  for (const k of kpis.kpis) {
    if (k.change_pct !== null) {
      out.add(pct(k.change_pct))
      out.add(`+${pct(k.change_pct)}`)
    }
    if (k.value !== null) out.add(String(k.value))
  }
  const sum = (rows: BreakdownRow[]) => rows.reduce((s, r) => s + Number(r.net_sales), 0)
  const total = sum(a) - sum(b)
  for (const r of a) {
    const d = Number(r.net_sales) - Number(b.find((x) => x.key === r.key)?.net_sales ?? 0)
    if (total) out.add(`${Math.round((d / total) * 100)}%`)
  }
  return out
}

describe('insight sentence (client fallback)', () => {
  it('names the move, its driver and the faster-rising discount, from the inputs only', () => {
    const kpis = kpiResponse()
    const i = buildInsight({ kpis, branches: now, previousBranches: prev })!
    expect(i.text).toBe('Net sales up 13.4%; EOS-02 drove 84% of the gain. Discounts rose faster (+22.1%).')
    expect(i.figures).toMatchObject({ change_pct: '0.1342', driver: 'EOS-02', discounts_change_pct: '0.2210' })
    expect(i.evidence).toMatchObject({ source: 'client' })
  })

  it('invents no numbers: every figure in the sentence is traceable to an input', () => {
    const cases = [
      { kpis: kpiResponse(), a: now, b: prev },
      { kpis: kpiResponse(), a: now, b: [] },
      { kpis: kpiResponse({ kpis: kpiResponse().kpis.map((k) => ({ ...k, change_pct: k.key === 'net_sales' ? '-0.0800' : k.change_pct })) }), a: prev, b: now },
    ]
    for (const c of cases) {
      const i = buildInsight({ kpis: c.kpis, branches: c.a, previousBranches: c.b })!
      const ok = allowed(c.kpis, c.a, c.b)
      for (const n of numbersIn(i.text)) expect(ok.has(n) || ok.has(n.replace(/^\+/, '')), `${n} in "${i.text}"`).toBe(true)
      // Codes like EOS-02 are not numbers and must not be split into "-02".
      expect(numbersIn(i.text)).not.toContain('-02')
    }
  })

  it('says so when there is no earlier period, and returns nothing without a net sales figure', () => {
    const noCompare = kpiResponse({ previous_period: null, kpis: kpiResponse().kpis.map((k) => ({ ...k, change_pct: null })) })
    expect(buildInsight({ kpis: noCompare, branches: now })!.text).toBe('Net sales OMR 40289.545; no earlier period to compare.')
    const noData = kpiResponse({ kpis: kpiResponse().kpis.map((k) => ({ ...k, status: 'no_data' as const, value: null })) })
    expect(buildInsight({ kpis: noData, branches: [] })).toBeNull()
  })

  it('does not credit a driver that explains under half of the move', () => {
    const spread = [row('EOS-01', '14000.000'), row('EOS-02', '13000.000'), row('EOS-03', '13289.545')]
    const before = [row('EOS-01', '12000.000'), row('EOS-02', '11500.000'), row('EOS-03', '12000.000')]
    expect(buildInsight({ kpis: kpiResponse(), branches: spread, previousBranches: before })!.text).not.toContain('drove')
  })
})

import type { Insight, Kpi, KpiResponse } from './types'
import type { TrendPoint } from './trend'

/**
 * Client-side fallback for the "Needs attention" row when GET /insights is unavailable. Only real
 * signals: partial figures with their coverage, the worst day against the median when the period
 * has at least 14 days, and lines left out for lack of an exchange rate.
 */
export function buildAttention(kpis: KpiResponse | undefined, trend: TrendPoint[], byDay: boolean, currency: string, decimals: number): Insight[] {
  const out: Insight[] = []
  if (!kpis) return out
  const seen = new Set<string>()
  for (const k of kpis.kpis as Kpi[]) {
    if (k.status !== 'partial') continue
    const cost = k.notes.find((n) => /unit cost/i.test(n))
    const fx = k.notes.find((n) => /exchange rate/i.test(n))
    if (cost && !seen.has('cost')) {
      seen.add('cost')
      const share = (1 - Number(k.coverage_pct)).toFixed(4)
      out.push({
        kind: 'missing_costs',
        severity: 'warning',
        text: `${cost}. Import product costs to complete gross profit.`,
        figures: { missing_cost_share: share },
        evidence: { period: kpis.period, fix: 'import product_costs', source: 'client' },
      })
    }
    if (fx && !seen.has('fx')) {
      seen.add('fx')
      out.push({ kind: 'missing_fx', severity: 'warning', text: `${fx}. Import exchange rates to include them.`, figures: {}, evidence: { period: kpis.period, fix: 'import fx_rates', source: 'client' } })
    }
  }
  if (byDay && trend.length >= 14) {
    const values = trend.map((d) => d.current).filter((v) => v > 0).sort((a, b) => a - b)
    if (values.length >= 10) {
      const med = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      const worst = trend.filter((d) => d.current > 0).reduce((w, d) => (d.current < w.current ? d : w), trend[0])
      const dev = (worst.current - med) / med
      if (med > 0 && dev <= -0.35) {
        out.push({
          kind: 'unusual_day',
          severity: 'notice',
          text: `${worst.key}: net sales ${worst.current.toFixed(decimals)} ${currency}, ${Math.round(Math.abs(dev) * 100)}% below the period's typical day (${med.toFixed(decimals)} ${currency}).`,
          figures: { date: worst.key, net_sales: worst.current.toFixed(decimals), median_day: med.toFixed(decimals), deviation_pct: dev.toFixed(4) },
          evidence: { period: kpis.period, dimension: 'day', source: 'client' },
        })
      }
    }
  }
  return out
}

import type { BreakdownRow, Insight, Kpi, KpiResponse } from './types'

/**
 * Client-side fallback for the insight strip when GET /insights is unavailable. Deterministic,
 * and built only from figures already on the page: the KPI payload and the branch breakdowns for
 * this and the previous period. It never estimates; every number in the sentence is one of the
 * inputs or a share computed from two of them, and `figures` lists them so they can be checked.
 */
export interface InsightInputs {
  kpis: KpiResponse
  branches: BreakdownRow[]
  previousBranches?: BreakdownRow[]
}

const pct = (v: string | number) => `${(Number(v) * 100).toFixed(1)}%`
const signed = (v: string | number) => `${Number(v) >= 0 ? '+' : ''}${pct(v)}`

export function buildInsight({ kpis, branches, previousBranches = [] }: InsightInputs): Insight | null {
  const byKey = new Map(kpis.kpis.map((k) => [k.key, k] as const))
  const net = byKey.get('net_sales')
  if (!net || net.value === null || net.status === 'no_data') return null
  const figures: Record<string, string | number> = {}
  const sentences: string[] = []

  const ch = net.change_pct === null ? null : Number(net.change_pct)
  if (ch === null) {
    figures.net_sales = String(net.value)
    sentences.push(`Net sales ${kpis.currency} ${String(net.value)}; no earlier period to compare.`)
  } else {
    figures.change_pct = net.change_pct!
    const word = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat'
    let s = word === 'flat' ? 'Net sales unchanged' : `Net sales ${word} ${pct(Math.abs(ch))}`
    // Driver: the branch whose move explains most of the whole move.
    const prev = new Map(previousBranches.map((r) => [r.key, Number(r.net_sales)]))
    const now = new Map(branches.map((r) => [r.key, Number(r.net_sales)]))
    const total = [...now.values()].reduce((a, b) => a + b, 0) - [...prev.values()].reduce((a, b) => a + b, 0)
    if (branches.length > 1 && previousBranches.length > 0 && total !== 0) {
      const moves = [...new Set([...now.keys(), ...prev.keys()])].map((k) => ({ k, d: (now.get(k) ?? 0) - (prev.get(k) ?? 0) }))
      moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      const top = moves[0]
      const share = top.d / total
      if (share >= 0.5 && Math.sign(top.d) === Math.sign(total)) {
        const shareQ = Math.round(share * 100)
        figures.driver = top.k
        figures.driver_share = String(shareQ / 100)
        s += `; ${top.k} drove ${shareQ}% of the ${ch > 0 ? 'gain' : 'fall'}`
      }
    }
    sentences.push(`${s}.`)
    // Margin pressure: discounts or returns rising faster than net sales.
    for (const [key, label] of [
      ['discounts', 'Discounts'],
      ['returns', 'Returns'],
    ] as const) {
      const k = byKey.get(key) as Kpi | undefined
      if (!k || k.change_pct === null) continue
      const c = Number(k.change_pct)
      if (c - ch >= 0.05 && Number(k.value) > 0) {
        figures[`${key}_change_pct`] = k.change_pct
        sentences.push(`${label} rose faster (${signed(c)}).`)
        break
      }
    }
  }
  return {
    kind: 'headline_change',
    severity: 'notice',
    text: sentences.join(' '),
    figures,
    evidence: { period: kpis.period, previous_period: kpis.previous_period, source: 'client' },
  }
}

/** Every number-like token in a sentence, as written. */
export function numbersIn(text: string): string[] {
  return text.match(/(?<![\w-])[-+]?\d[\d,]*(?:\.\d+)?%?(?![\w-])/g) ?? []
}

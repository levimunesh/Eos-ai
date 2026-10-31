/** Calendar-date helpers on plain YYYY-MM-DD strings (no timezone drift). */

export type Preset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_12_months'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom'

/** The segmented control's quick picks, in order. Everything else lives under "Custom". */
export const SEGMENTS: Exclude<Preset, 'custom'>[] = ['last_7_days', 'last_30_days', 'last_90_days', 'last_12_months']

export const PRESETS: Exclude<Preset, 'custom'>[] = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_12_months',
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'last_year',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parseIso(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

function toUtc(s: string): Date {
  const p = parseIso(s)!
  return new Date(Date.UTC(p.y, p.m - 1, p.d))
}

function fromUtc(d: Date): string {
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addDays(s: string, days: number): string {
  const d = toUtc(s)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1
}

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Today's calendar date in an IANA timezone. */
export function todayIn(timeZone?: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return fromUtc(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
  }
}

export function presetRange(preset: Exclude<Preset, 'custom'>, today: string): { from: string; to: string } {
  const { y, m } = parseIso(today)!
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const d = addDays(today, -1)
      return { from: d, to: d }
    }
    case 'last_7_days':
      return { from: addDays(today, -6), to: today }
    case 'last_30_days':
      return { from: addDays(today, -29), to: today }
    case 'last_90_days':
      return { from: addDays(today, -89), to: today }
    case 'last_12_months': {
      // Twelve whole months ending today: the 1st of the month eleven months back.
      const sm = m - 11
      const sy = sm < 1 ? y - 1 : y
      return { from: iso(sy, sm < 1 ? sm + 12 : sm, 1), to: today }
    }
    case 'this_month':
      return { from: iso(y, m, 1), to: today }
    case 'last_month': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      return { from: iso(py, pm, 1), to: iso(py, pm, lastDayOfMonth(py, pm)) }
    }
    case 'this_quarter': {
      const qm = Math.floor((m - 1) / 3) * 3 + 1
      return { from: iso(y, qm, 1), to: today }
    }
    case 'this_year':
      return { from: iso(y, 1, 1), to: today }
    case 'last_year':
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) }
  }
}

/** The whole calendar month for a "YYYY-MM" key. */
export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split('-').map(Number)
  return { from: iso(y, m, 1), to: iso(y, m, lastDayOfMonth(y, m)) }
}

export function monthKey(s: string): string {
  return s.slice(0, 7)
}

import type { DateFormat } from './types'

function parts(iso: string, timeZone?: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    fmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  return { y: p.year, m: p.month, d: p.day }
}

/** Format a timestamp as a calendar date in the organisation's format and timezone. */
export function formatDate(iso: string, format: DateFormat = 'DD/MM/YYYY', timeZone?: string): string {
  const p = parts(iso, timeZone)
  if (!p) return iso
  if (format === 'MM/DD/YYYY') return `${p.m}/${p.d}/${p.y}`
  if (format === 'YYYY-MM-DD') return `${p.y}-${p.m}-${p.d}`
  return `${p.d}/${p.m}/${p.y}`
}

/** Return a same-origin path from a `next` query param, or the fallback. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

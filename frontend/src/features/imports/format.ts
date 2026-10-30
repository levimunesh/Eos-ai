import { locale, t, type StringKey } from '@/lib/strings'
import type { ImportStatus } from './types'

export function errorCodeLabel(code: string): string {
  const key = `imports.codes.${code}` as StringKey
  const label = t(key)
  if (label !== key) return label
  const words = code.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function statusLabel(status: ImportStatus): string {
  return t(`imports.status.${status}` as StringKey)
}

export function statusTone(status: ImportStatus): 'success' | 'danger' | 'accent' | 'warning' | 'neutral' {
  switch (status) {
    case 'done':
      return 'success'
    case 'failed':
      return 'danger'
    case 'validating':
    case 'importing':
      return 'accent'
    case 'validated':
      return 'warning'
    default:
      return 'neutral'
  }
}

const nf = new Intl.NumberFormat(locale)
export function count(n: number | null | undefined): string {
  return nf.format(n ?? 0)
}

/** Formats a decimal string without float rounding: thousands groups on the integer part only. */
export function money(amount: string): string {
  const neg = amount.startsWith('-')
  const [i, f] = (neg ? amount.slice(1) : amount).split('.')
  const grouped = nf.format(BigInt(i || '0'))
  return `${neg ? '-' : ''}${grouped}${f ? `.${f}` : ''}`
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const rtf = (() => {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    return null
  }
})()

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 3600],
    ['hour', 86400],
    ['day', 86400 * 7],
    ['week', 86400 * 30],
    ['month', 86400 * 365],
    ['year', Infinity],
  ]
  const div: Record<string, number> = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 }
  for (const [unit, limit] of units) {
    if (abs < limit) {
      const v = Math.round(diff / div[unit])
      return rtf ? rtf.format(v, unit) : new Date(iso).toLocaleString()
    }
  }
  return new Date(iso).toLocaleString()
}

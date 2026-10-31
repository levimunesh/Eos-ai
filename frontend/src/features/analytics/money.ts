import { locale } from '@/lib/strings'

const group = new Intl.NumberFormat(locale)

/**
 * Formats a decimal string (or integer) to exactly `decimals` places without going through
 * floating point, so large OMR/KWD totals keep every fil.
 */
export function formatDecimal(value: string | number, decimals: number): string {
  const s = typeof value === 'number' ? value.toString() : value.trim()
  const neg = s.startsWith('-')
  const body = neg || s.startsWith('+') ? s.slice(1) : s
  const [intRaw, fracRaw = ''] = body.split('.')
  let intPart = BigInt(intRaw || '0')
  let frac = fracRaw
  if (frac.length > decimals) {
    // Round half up on the dropped digits.
    const keep = frac.slice(0, decimals)
    const roundUp = Number(frac[decimals]) >= 5
    let n = BigInt((intPart.toString() + keep) || '0')
    if (roundUp) n += 1n
    const str = n.toString().padStart(decimals + 1, '0')
    intPart = BigInt(str.slice(0, str.length - decimals) || '0')
    frac = decimals ? str.slice(str.length - decimals) : ''
  } else {
    frac = frac.padEnd(decimals, '0')
  }
  const isZero = intPart === 0n && /^0*$/.test(frac)
  const sign = neg && !isZero ? '-' : ''
  return `${sign}${group.format(intPart)}${decimals ? `.${frac}` : ''}`
}

export function formatMoney(value: string | number, currency: string, decimals: number): string {
  return `${currency} ${formatDecimal(value, decimals)}`
}

export function formatCount(value: string | number): string {
  return group.format(typeof value === 'number' ? value : Number(value))
}

/** "0.3821" -> "38.2%". */
export function formatRatio(value: string | number, digits = 1): string {
  return `${(Number(value) * 100).toFixed(digits)}%`
}

/** "-0.0431" -> "4.3%" (sign carried by the arrow). */
export function formatChange(value: string): string {
  return `${Math.abs(Number(value) * 100).toFixed(1)}%`
}

/** Short axis labels: 418364 -> "418K". */
export function compactNumber(n: number): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  } catch {
    return String(Math.round(n))
  }
}

/** Exact string conversion between a percentage the user types and the API's decimal rate. */

export const PERCENT_PATTERN = /^\d{1,2}(\.\d{1,2})?$/

/** "5" -> "0.05", "12.5" -> "0.125", "0" -> "0". Assumes PERCENT_PATTERN already matched. */
export function percentToDecimalString(percent: string): string {
  const [intPart, frac = ''] = percent.trim().split('.')
  const digits = (intPart.padStart(2, '0') + frac).replace(/^0+(?=\d)/, '')
  const scale = frac.length + 2
  const padded = digits.padStart(scale + 1, '0')
  const whole = padded.slice(0, padded.length - scale)
  const fraction = padded.slice(padded.length - scale).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** "0.0500" -> "5", "0.125" -> "12.5", "0" -> "0". */
export function decimalStringToPercent(rate: string): string {
  const [intPart, frac = ''] = rate.trim().split('.')
  const fracPadded = frac.padEnd(2, '0')
  const whole = (intPart + fracPadded.slice(0, 2)).replace(/^0+(?=\d)/, '')
  const rest = fracPadded.slice(2).replace(/0+$/, '')
  return rest ? `${whole}.${rest}` : whole
}

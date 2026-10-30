import { locale } from './strings'

/** Mirrors backend app/core/currency.py MINOR_UNITS. */
export const CURRENCY_CODES = [
  'OMR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'JOD', 'EGP', 'IQD', 'LBP', 'TRY', 'ILS', 'IRR',
  'KES', 'UGX', 'TZS', 'RWF', 'ETB', 'NGN', 'GHS', 'ZAR', 'MAD', 'TND', 'DZD', 'LYD', 'XOF',
  'XAF', 'MUR', 'ZMW',
  'INR', 'PKR', 'BDT', 'LKR', 'NPR', 'CNY', 'HKD', 'JPY', 'KRW', 'SGD', 'MYR', 'THB', 'IDR',
  'PHP', 'VND', 'AUD', 'NZD', 'TWD',
  'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'RUB', 'UAH', 'ISK',
  'USD', 'CAD', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN',
] as const

let names: Intl.DisplayNames | null | undefined

export function currencyName(code: string): string {
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([locale], { type: 'currency' })
    } catch {
      names = null
    }
  }
  try {
    return names?.of(code) ?? code
  } catch {
    return code
  }
}

export function currencyOptions() {
  return CURRENCY_CODES.map((code) => ({ value: code, label: code, hint: currencyName(code) }))
}

const FALLBACK = [
  'UTC', 'Asia/Muscat', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain',
  'Asia/Amman', 'Africa/Cairo', 'Asia/Baghdad', 'Europe/Istanbul', 'Africa/Nairobi',
  'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo',
]

export function listTimezones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }
    const values = intl.supportedValuesOf?.('timeZone')
    if (values?.length) return values.includes('UTC') ? values : ['UTC', ...values]
  } catch {
    // Older browsers: fall through.
  }
  return FALLBACK
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timezoneOptions(extra?: string) {
  const zones = listTimezones()
  if (extra && !zones.includes(extra)) zones.unshift(extra)
  return zones.map((z) => ({ value: z, label: z.replaceAll('_', ' ') }))
}

/** Date and time of a sale in the organisation's timezone, e.g. "14 Mar 2025, 19:31". */
export function formatSaleTime(iso: string, timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  try {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-GB', opts).format(d)
  }
}

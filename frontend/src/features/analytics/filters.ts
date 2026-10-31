import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseIso, presetRange, PRESETS, todayIn, type Preset } from './dates'

export interface Filters {
  preset: Preset
  from: string
  to: string
  branchIds: string[]
  compare: boolean
  /** True when no period is in the URL, so the dashboard may pick a fallback month. */
  isDefault: boolean
}

export const DEFAULT_PRESET: Preset = 'this_month'

/** Reads filters from a URL query; invalid values fall back to defaults. */
export function readFilters(params: URLSearchParams, today: string): Filters {
  const rawPreset = params.get('period') as Preset | null
  const from = params.get('from')
  const to = params.get('to')
  const branchIds = (params.get('branches') ?? '').split(',').filter(Boolean)
  const compare = params.get('compare') !== '0'
  if (rawPreset === 'custom' && from && to && parseIso(from) && parseIso(to) && from <= to) {
    return { preset: 'custom', from, to, branchIds, compare, isDefault: false }
  }
  const preset = rawPreset && (PRESETS as string[]).includes(rawPreset) ? (rawPreset as Exclude<Preset, 'custom'>) : DEFAULT_PRESET
  return { preset, ...presetRange(preset as Exclude<Preset, 'custom'>, today), branchIds, compare, isDefault: !rawPreset }
}

export function writeFilters(params: URLSearchParams, f: Partial<Filters>): URLSearchParams {
  const next = new URLSearchParams(params)
  if (f.preset) {
    next.set('period', f.preset)
    if (f.preset === 'custom') {
      if (f.from) next.set('from', f.from)
      if (f.to) next.set('to', f.to)
    } else {
      next.delete('from')
      next.delete('to')
    }
  }
  if (f.branchIds) {
    if (f.branchIds.length) next.set('branches', f.branchIds.join(','))
    else next.delete('branches')
  }
  if (f.compare !== undefined) {
    if (f.compare) next.delete('compare')
    else next.set('compare', '0')
  }
  return next
}

/** Filter state stored in the URL query so views are shareable and survive refresh. */
export function useFilters(timeZone?: string) {
  const [params, setParams] = useSearchParams()
  const today = todayIn(timeZone)
  const filters = useMemo(() => readFilters(params, today), [params, today])
  const update = useCallback(
    (f: Partial<Filters>) => setParams((p) => writeFilters(p, f), { replace: false }),
    [setParams],
  )
  /** The filter query string to carry onto another page (e.g. the records view). */
  const carry = useMemo(() => {
    const keep = new URLSearchParams()
    for (const k of ['period', 'from', 'to', 'branches', 'compare']) {
      const v = params.get(k)
      if (v) keep.set(k, v)
    }
    return keep.toString()
  }, [params])
  return { filters, update, today, carry }
}

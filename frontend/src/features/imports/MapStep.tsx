import { AlertTriangle, History, Lightbulb, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { InlineError } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { useOrgQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { DATE_FORMATS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSaveMapping, useValidateImport } from './api'
import { count } from './format'
import type { EntityType, ImportOptions, ImportRecord, ThousandsSeparator } from './types'

const THOUSANDS: { value: string; label: Parameters<typeof t>[0]; sep: ThousandsSeparator }[] = [
  { value: 'none', label: 'imports.map.thousandsNone', sep: null },
  { value: 'comma', label: 'imports.map.thousandsComma', sep: ',' },
  { value: 'space', label: 'imports.map.thousandsSpace', sep: ' ' },
  { value: 'dot', label: 'imports.map.thousandsDot', sep: '.' },
  { value: 'apostrophe', label: 'imports.map.thousandsApostrophe', sep: "'" },
]

function ConfidenceBadge({ confidence, saved }: { confidence: number; saved: boolean }) {
  if (saved) {
    return (
      <Badge tone="accent">
        <History aria-hidden className="size-3" />
        {t('imports.map.savedMapping')}
      </Badge>
    )
  }
  if (confidence >= 0.85) return <Badge tone="success">{t('imports.map.confidenceHigh')}</Badge>
  if (confidence >= 0.6) return <Badge tone="neutral">{t('imports.map.confidenceMedium')}</Badge>
  return <Badge tone="warning">{t('imports.map.confidenceLow')}</Badge>
}

export function CheckingState({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="relative flex size-12 items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-accent-soft motion-safe:animate-ping motion-safe:[animation-duration:2s]" />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" />
        </span>
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
      </div>
      <div aria-hidden className="h-1 w-48 overflow-hidden rounded-full bg-subtle">
        <div className="h-full w-1/3 rounded-full bg-[image:var(--dawn)] motion-safe:animate-[eos-indeterminate_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

export function MapStep({ record, entity }: { record: ImportRecord; entity: EntityType }) {
  const save = useSaveMapping()
  const org = useOrgQuery()
  const validate = useValidateImport()
  const preview = record.preview
  const headers = preview.headers
  const saved = preview.mapping_source === 'saved'

  const [map, setMap] = useState<Record<string, string>>(() => ({ ...record.column_map }))
  const [dateFormat, setDateFormat] = useState(record.options.date_format ?? 'DD/MM/YYYY')
  const [thousands, setThousands] = useState<string>(
    THOUSANDS.find((o) => o.sep === (record.options.thousands_separator ?? null))?.value ?? 'none',
  )
  const [sheet, setSheet] = useState(record.options.sheet ?? preview.sheet ?? '')
  const [headerRow, setHeaderRow] = useState(String((record.options.header_row ?? preview.header_row ?? 0) + 1))
  const [attempted, setAttempted] = useState(false)

  const missing = entity.fields.filter((f) => f.required && !map[f.key])
  const usage = useMemo(() => {
    const c = new Map<string, number>()
    for (const v of Object.values(map)) if (v) c.set(v, (c.get(v) ?? 0) + 1)
    return c
  }, [map])
  const mapped = new Set(Object.values(map).filter(Boolean))
  const fieldFor = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of entity.fields) if (map[f.key]) m.set(map[f.key], f.label)
    return m
  }, [map, entity.fields])

  const busy = save.isPending || validate.isPending
  const serverError = save.error ?? validate.error
  const prior = preview.same_file_imported_before ?? []

  const check = async () => {
    setAttempted(true)
    if (missing.length) return
    const options: ImportOptions = {
      date_format: dateFormat,
      thousands_separator: THOUSANDS.find((o) => o.value === thousands)?.sep ?? null,
    }
    if (preview.sheets.length > 1) options.sheet = sheet
    const hr = Number(headerRow) - 1
    if (Number.isInteger(hr) && hr >= 0 && hr !== preview.header_row) options.header_row = hr
    const columnMap: Record<string, string | null> = {}
    for (const f of entity.fields) columnMap[f.key] = map[f.key] || null
    try {
      await save.mutateAsync({ id: record.id, columnMap, options })
      await validate.mutateAsync(record.id)
    } catch {
      // Rendered through serverError.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {prior.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{t('imports.map.sameFileTitle')}</p>
            <p className="text-sm">
              {t('imports.map.sameFileBody', {
                date: formatDate(prior[0].created_at, org.data?.date_format, org.data?.timezone),
                status: t(`imports.status.${prior[0].status}`),
              })}
            </p>
          </div>
        </div>
      )}

      {saved && (
        <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent-text">
          <History aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('imports.map.savedMappingBody')}
        </p>
      )}

      <section aria-labelledby="map-fields" className="overflow-hidden rounded-xl border border-line">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line bg-subtle/80 px-4 py-2.5 text-xs font-medium text-muted sm:grid">
          <span id="map-fields">{t('imports.map.fieldsHeading')}</span>
          <span>{t('imports.map.columnHeading')}</span>
        </div>
        <ul>
          {entity.fields.map((f) => {
            const value = map[f.key] ?? ''
            const suggestion = preview.suggestions?.[f.key]
            const fromSuggestion = !!value && suggestion?.column === value
            const showConfidence = (saved && !!value && record.column_map[f.key] === value) || fromSuggestion
            const dup = value && (usage.get(value) ?? 0) > 1
            const invalid = attempted && f.required && !value
            const selectId = `map-${f.key}`
            return (
              <li
                key={f.key}
                className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <label htmlFor={selectId} className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {f.label}
                    {f.required && <Badge tone="outline">{t('imports.map.required')}</Badge>}
                  </label>
                  {f.help && <p className="mt-0.5 text-xs text-muted">{f.help}</p>}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Select
                    id={selectId}
                    value={value}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value }))}
                  >
                    <option value="">{f.required ? t('imports.map.choose') : t('imports.map.notMapped')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {showConfidence && <ConfidenceBadge confidence={suggestion?.confidence ?? 1} saved={saved} />}
                    {dup && <Badge tone="warning">{t('imports.map.duplicateColumn')}</Badge>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="map-options" className="flex flex-col gap-4">
        <h2 id="map-options" className="text-[0.9375rem] font-semibold">
          {t('imports.map.optionsHeading')}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="opt-date" label={t('imports.map.dateFormat')}>
            <Select id="opt-date" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            {preview.date_format_hint && preview.date_format_hint !== dateFormat && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warning">
                <Lightbulb aria-hidden className="size-3.5" />
                {t('imports.map.dateHint', { format: preview.date_format_hint })}
                <button
                  type="button"
                  className="font-medium text-accent-text underline-offset-2 hover:underline"
                  onClick={() => setDateFormat(preview.date_format_hint!)}
                >
                  {t('imports.map.useHint', { format: preview.date_format_hint })}
                </button>
              </p>
            )}
          </Field>
          <Field id="opt-thousands" label={t('imports.map.thousands')}>
            <Select id="opt-thousands" value={thousands} onChange={(e) => setThousands(e.target.value)}>
              {THOUSANDS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </Select>
          </Field>
          {preview.sheets.length > 1 && (
            <Field id="opt-sheet" label={t('imports.map.sheet')}>
              <Select id="opt-sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>
                {preview.sheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field id="opt-header" label={t('imports.map.headerRow')} hint={t('imports.map.headerRowHint')}>
            <Input
              id="opt-header"
              type="number"
              min={1}
              inputMode="numeric"
              className="tabular-nums"
              value={headerRow}
              onChange={(e) => setHeaderRow(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="map-preview" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map-preview" className="text-[0.9375rem] font-semibold">
            {t('imports.map.previewHeading')}
          </h2>
          <p className="text-xs text-muted tabular-nums">
            {t('imports.map.previewCaption', { shown: preview.rows.length, total: count(preview.row_count) })}
          </p>
        </div>
        <div className="max-h-80 overflow-auto rounded-xl border border-line" tabIndex={0} aria-label={t('imports.map.previewHeading')}>
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky start-0 z-20 border-b border-line bg-subtle px-3 py-2 text-end font-medium text-muted tabular-nums">#</th>
                {headers.map((h) => {
                  const on = mapped.has(h)
                  return (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        'border-b border-line px-3 py-2 text-start align-bottom font-medium whitespace-nowrap',
                        on ? 'bg-accent-soft text-accent-text' : 'bg-subtle text-muted',
                      )}
                    >
                      <span className="block">{h}</span>
                      {on && <span className="block text-2xs font-normal opacity-80">{fieldFor.get(h)}</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, r) => (
                <tr key={r}>
                  <td className="sticky start-0 border-b border-line bg-surface px-3 py-1.5 text-end text-muted tabular-nums">
                    {preview.header_row + 2 + r}
                  </td>
                  {headers.map((h, c) => (
                    <td
                      key={h}
                      className={cn(
                        'max-w-56 truncate border-b border-line px-3 py-1.5 whitespace-nowrap',
                        mapped.has(h) ? 'bg-accent-soft/40 text-fg' : 'text-fg-2',
                      )}
                    >
                      {row[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {attempted && missing.length > 0 && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger-text">
          {t('imports.map.missingRequired', { fields: missing.map((f) => f.label).join(', ') })}
        </p>
      )}
      <InlineError error={serverError} />

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted tabular-nums">
          {t('imports.map.fileInfo', { rows: count(preview.row_count), cols: headers.length })}
        </p>
        <Button onClick={() => void check()} disabled={busy} className="w-full sm:w-auto sm:min-w-40">
          {busy ? t('imports.map.saving') : t('imports.map.check')}
        </Button>
      </div>
    </div>
  )
}

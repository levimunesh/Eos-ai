import { CircleAlert, CircleCheck, Download, Info, Pencil, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { InlineError } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useCommitImport, useDownloadErrors, useValidateImport } from './api'
import { count, errorCodeLabel, money } from './format'
import type { ConflictMode, ImportRecord, QualityReport } from './types'

function Stat({
  label,
  value,
  tone = 'default',
  detail,
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'danger' | 'warning'
  detail?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 border-s border-line ps-3 first:border-s-0 first:ps-0">
      <dt className="flex items-center gap-1.5 text-body text-fg-2">
        {tone !== 'default' && (
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              tone === 'success' && 'bg-success',
              tone === 'danger' && 'bg-danger',
              tone === 'warning' && 'bg-warning',
            )}
          />
        )}
        {label}
      </dt>
      <dd className="flex flex-col gap-0.5">
        <span className="num text-kpi text-fg">{count(value)}</span>
        {detail && <span className="text-caption text-muted">{detail}</span>}
      </dd>
    </div>
  )
}

export function ReportStats({ report }: { report: QualityReport }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
      <Stat
        label={t('imports.review.totalRows')}
        value={report.rows_total}
        detail={report.blank_rows_ignored ? t('imports.review.blankIgnored', { n: count(report.blank_rows_ignored) }) : undefined}
      />
      <Stat
        label={t('imports.review.ready')}
        value={report.rows_valid}
        tone="success"
        detail={report.replaced_records ? t('imports.review.replaced', { n: count(report.replaced_records) }) : undefined}
      />
      <Stat label={t('imports.review.rejected')} value={report.rows_rejected} tone={report.rows_rejected ? 'danger' : 'default'} />
      <Stat
        label={t('imports.review.duplicates')}
        value={report.rows_duplicate}
        tone={report.rows_duplicate ? 'warning' : 'default'}
        detail={
          <>
            <span className="block">{t('imports.review.dupInFile', { n: count(report.duplicates.in_file) })}</span>
            <span className="block">{t('imports.review.dupInEos', { n: count(report.duplicates.already_in_eos) })}</span>
          </>
        }
      />
    </dl>
  )
}

function ErrorsByCode({ report }: { report: QualityReport }) {
  const entries = Object.entries(report.errors_by_code)
  const max = Math.max(1, ...entries.map(([, n]) => n))
  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map(([code, n]) => (
        <li key={code} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-body sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
          <span className="truncate text-fg-2" title={code}>
            {errorCodeLabel(code)}
          </span>
          <span aria-hidden className="h-1.5 overflow-hidden bg-surface-2">
            <span className="block h-full bg-danger/60" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="num text-end text-fg">{count(n)}</span>
        </li>
      ))}
    </ul>
  )
}

function Totals({ report }: { report: QualityReport }) {
  const tt = report.totals
  const rows: [string, React.ReactNode][] = []
  if (tt.date_range) rows.push([t('imports.review.dateRange'), `${tt.date_range.from} – ${tt.date_range.to}`])
  if (typeof tt.receipts === 'number') rows.push([t('imports.review.receipts'), count(tt.receipts)])
  if (typeof tt.documents === 'number') rows.push([t('imports.review.documents'), count(tt.documents)])
  if (tt.value_by_currency)
    rows.push([
      t('imports.review.value'),
      Object.entries(tt.value_by_currency)
        .map(([c, v]) => `${c} ${money(v)}`)
        .join(', '),
    ])
  for (const [k, v] of Object.entries(tt)) {
    if (['date_range', 'receipts', 'documents', 'value_by_currency', 'by_branch', 'by_category', 'receipt_status', 'currencies'].includes(k)) continue
    if (typeof v === 'number') rows.push([k.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()), count(v)])
  }
  const branches = tt.by_branch ? Object.entries(tt.by_branch) : []
  const categories = tt.by_category ? Object.entries(tt.by_category) : []

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 && (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 sm:block sm:border-0 sm:py-0">
              <dt className="text-caption text-muted">{label}</dt>
              <dd className="num text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {branches.length > 0 && (
        <div>
          <Table aria-label={t('imports.review.byBranch')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('imports.review.branch')}</TableHead>
                <TableHead className="text-end">{t('imports.review.receipts')}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t('imports.review.lines')}</TableHead>
                <TableHead className="text-end">{t('imports.review.net')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map(([code, b]) => (
                <TableRow key={code}>
                  <TableCell className="mono">{code}</TableCell>
                  <TableCell className="num text-end">{count(b.receipts)}</TableCell>
                  <TableCell className="num hidden text-end sm:table-cell">{count(b.lines)}</TableCell>
                  <TableCell className="num text-end whitespace-nowrap">
                    {Object.entries(b.net_by_currency).map(([c, v]) => (
                      <span key={c} className="block">
                        <span className="text-muted">{c}</span> {money(v)}
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {categories.length > 0 && (
        <dl className="flex flex-col divide-y divide-line border-t border-line">
          {categories.map(([cat, v]) => (
            <div key={cat} className="flex h-8 items-center justify-between gap-3 px-3 text-body">
              <dt className="truncate text-fg-2">{cat}</dt>
              <dd className="num text-fg">{money(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function ReviewStep({ record, onEditMapping }: { record: ImportRecord; onEditMapping: () => void }) {
  const report = record.quality_report!
  const commit = useCommitImport()
  const download = useDownloadErrors()
  const validate = useValidateImport()
  const [mode, setMode] = useState<ConflictMode>(record.conflict_mode ?? 'skip')
  const hasErrors = report.rows_rejected > 0 || Object.keys(report.errors_by_code).length > 0
  const nothingValid = report.rows_valid === 0
  const existing = report.duplicates.already_in_eos + report.replaced_records

  return (
    <div className="flex flex-col gap-5">
      <ReportStats report={report} />

      {report.warnings.length > 0 && (
        <Section title={t('imports.review.warningsHeading')}>
          <ul className="flex flex-col gap-2">
            {report.warnings.map((w) => (
              <li key={w} className="flex items-start gap-2 text-body text-fg-2">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={t('imports.review.errorsHeading')}
        actions={
          hasErrors ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={download.isPending}
              onClick={() => download.mutate({ id: record.id, fileName: record.file_name })}
            >
              <Download aria-hidden />
              {download.isPending ? t('imports.review.downloading') : t('imports.review.download')}
            </Button>
          ) : undefined
        }
      >
        {hasErrors ? (
          <>
            <ErrorsByCode report={report} />
            {report.errors_sample.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted">{t('imports.review.sampleCaption', { n: report.errors_sample.length })}</p>
                <div>
                  <Table aria-label={t('imports.review.sampleHeading')}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-end">{t('imports.review.colRow')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('imports.review.colColumn')}</TableHead>
                        <TableHead>{t('imports.review.colProblem')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.errors_sample.map((e, i) => (
                        <TableRow key={`${e.row}-${e.code}-${i}`}>
                          <TableCell className="mono text-end align-top">{e.row}</TableCell>
                          <TableCell className="mono hidden align-top text-fg-2 sm:table-cell">{e.column ?? '–'}</TableCell>
                          <TableCell className="align-top">
                            <span className="block text-caption font-medium text-danger-text">{errorCodeLabel(e.code)}</span>
                            <span className="block text-fg-2">{e.message}</span>
                            {e.column && <span className="mono block text-muted sm:hidden">{e.column}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <InlineError error={download.error} />
          </>
        ) : (
          <p className="flex items-center gap-2 text-body text-success">
            <CircleCheck aria-hidden className="size-3.5" />
            {t('imports.review.errorsEmpty')}
          </p>
        )}
      </Section>

      <Section title={t('imports.review.totalsHeading')}>
        <Totals report={report} />
      </Section>

      {existing > 0 && !nothingValid && (
        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <legend className="float-start mb-2 text-title">{t('imports.review.conflictHeading')}</legend>
          {(['skip', 'replace'] as const).map((m) => (
            <label
              key={m}
              className={cn(
                'flex min-h-10 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:shadow-[0_0_0_3px_var(--ring-halo)]',
                mode === m ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle',
              )}
            >
              <input
                type="radio"
                name="conflict-mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mt-1 accent-[var(--accent)] focus-visible:outline-none"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium">{m === 'skip' ? t('imports.review.skipLabel') : t('imports.review.replaceLabel')}</span>
                <span className="text-caption text-muted">{m === 'skip' ? t('imports.review.skipBody') : t('imports.review.replaceBody')}</span>
              </span>
            </label>
          ))}
          {mode !== report.conflict_mode && (
            <p className="text-xs text-muted">{t('imports.review.recheckHint')}</p>
          )}
        </fieldset>
      )}

      {nothingValid && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('imports.review.nothingValid')}
        </p>
      )}

      <InlineError error={commit.error ?? validate.error} />

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onEditMapping}>
            <Pencil aria-hidden />
            {t('imports.review.editMapping')}
          </Button>
          <Button variant="ghost" disabled={validate.isPending} onClick={() => validate.mutate(record.id)}>
            <RotateCcw aria-hidden />
            {t('imports.review.recheck')}
          </Button>
        </div>
        <Button
          disabled={nothingValid || commit.isPending}
          onClick={() => commit.mutate({ id: record.id, conflictMode: mode })}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {t('imports.review.importAction', { n: count(report.rows_valid) })}
        </Button>
      </div>
    </div>
  )
}

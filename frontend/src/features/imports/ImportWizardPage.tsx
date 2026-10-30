import { ArrowLeft, CircleCheck, CircleX, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorBlock, InlineError, LoadingBlock, PageHeader } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import { useEntitiesQuery, useImportQuery, useImportsQuery, useValidateImport } from './api'
import { FileStep } from './FileStep'
import { count, fileSize } from './format'
import { StatusPill } from './ImportsPage'
import { CheckingState, MapStep } from './MapStep'
import { ReportStats, ReviewStep } from './ReviewStep'
import type { EntityType, ImportRecord } from './types'
import { WizardSteps } from './WizardSteps'
import { viewFor, type WizardView } from './wizard-state'

const STEP_OF: Record<WizardView, number> = { file: 0, map: 1, checking: 1, review: 2, importing: 2, done: 2, failed: 2 }

function FileBadge({ record, entity }: { record: ImportRecord; entity?: EntityType }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-subtle/60 px-3.5 py-2.5 text-sm">
      <span className="min-w-0 truncate font-medium">{record.file_name}</span>
      <span className="text-xs text-muted tabular-nums">
        {entity?.label ?? record.entity_type}, {fileSize(record.file_size)}
      </span>
      <span className="ms-auto">
        <StatusPill status={record.status} />
      </span>
    </div>
  )
}

function DoneState({ record }: { record: ImportRecord }) {
  const { membership } = useOrg()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheck aria-hidden className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">{t('imports.review.doneTitle')}</h2>
        <p className="max-w-md text-sm text-muted">
          {t('imports.review.doneBody', { file: record.file_name, org: membership.org_name })}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ['imports.review.totalRows', record.rows_total],
            ['imports.review.imported', record.rows_imported],
            ['imports.review.rejected', record.rows_rejected],
            ['imports.review.duplicates', record.rows_duplicate],
          ] as const
        ).map(([key, n]) => (
          <div key={key} className="surface-raised flex flex-col gap-1 rounded-xl p-4">
            <dt className="text-[0.8125rem] font-medium text-fg-2">{t(key)}</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">{count(n)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Link to="/imports" className={buttonVariants({ variant: 'secondary' })}>
          {t('imports.review.viewHistory')}
        </Link>
        <Link to="/imports/new" className={buttonVariants()}>
          {t('imports.review.another')}
        </Link>
      </div>
    </div>
  )
}

function FailedState({ record, onEdit }: { record: ImportRecord; onEdit: () => void }) {
  const validate = useValidateImport()
  return (
    <div className="flex flex-col gap-6">
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4">
        <CircleX aria-hidden className="mt-0.5 size-5 shrink-0 text-danger-text" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-danger-text">{t('imports.review.failedTitle')}</h2>
          <p className="text-sm text-fg-2">{t('imports.review.failedBody')}</p>
          {record.last_error && (
            <p className="mt-1 rounded-md bg-surface/70 px-2.5 py-1.5 text-sm break-words text-fg ring-1 ring-line ring-inset">
              {record.last_error}
            </p>
          )}
        </div>
      </div>
      {record.quality_report && <ReportStats report={record.quality_report} />}
      <InlineError error={validate.error} />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onEdit}>
          <Pencil aria-hidden />
          {t('imports.review.editMapping')}
        </Button>
        <Button disabled={validate.isPending} onClick={() => validate.mutate(record.id)}>
          <RotateCcw aria-hidden />
          {t('imports.review.recheck')}
        </Button>
      </div>
    </div>
  )
}

export function ImportWizardPage() {
  const { role } = useOrg()
  const [params] = useSearchParams()
  if (role === 'viewer') return <PageHeader title={t('imports.title')} description={t('imports.viewerNoAccess')} />
  // Remount per import so local state (such as "editing columns") never leaks between imports.
  return <Wizard key={params.get('id') ?? 'new'} />
}

function Wizard() {
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const entities = useEntitiesQuery()
  const history = useImportsQuery()
  const imp = useImportQuery(id)
  const toast = useToast()
  // Editing columns from the review/failed screen; tied to the report it started from so a new
  // check result (a different generated_at or error) shows normally.
  const [editingFrom, setEditingFrom] = useState<string | null>(null)
  const record = id ? imp.data : undefined
  const stamp = record ? `${record.status}:${record.quality_report?.generated_at ?? ''}:${record.last_error ?? ''}` : ''
  const editing = editingFrom !== null && editingFrom === stamp
  const setEditing = (on: boolean) => setEditingFrom(on ? stamp : null)
  const view = viewFor(record, editing)
  const entity = entities.data?.find((e) => e.key === record?.entity_type)
  const doneTypes = useMemo(
    () => new Set((history.data ?? []).filter((i) => i.status === 'done').map((i) => i.entity_type)),
    [history.data],
  )

  // Announce a finished import once, when polling sees importing -> done.
  const status = record?.status
  const prevStatus = useRef(status)
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status
    if (prev === 'importing' && status === 'done' && record) {
      toast.success(t('imports.review.toast', { n: count(record.rows_imported), file: record.file_name }))
    }
  }, [status, record, toast])

  const step = STEP_OF[view]
  const titles = [
    ['imports.wizard.steps.file', 'imports.wizard.steps.fileBody'],
    ['imports.wizard.steps.map', 'imports.wizard.steps.mapBody'],
    ['imports.wizard.steps.review', 'imports.wizard.steps.reviewBody'],
  ] as const

  let body: React.ReactNode
  if (entities.isPending || (id && imp.isPending)) body = <LoadingBlock />
  else if (entities.isError) body = <ErrorBlock error={entities.error} onRetry={() => void entities.refetch()} />
  else if (id && imp.isError) body = <ErrorBlock error={imp.error} onRetry={() => void imp.refetch()} />
  else if (view === 'file')
    body = (
      <FileStep
        entities={entities.data}
        doneTypes={doneTypes}
        onUploaded={(rec) => setParams({ id: rec.id }, { replace: false })}
      />
    )
  else if (!record || !entity) body = <ErrorBlock error={null} />
  else if (view === 'map') body = <MapStep key={`${record.id}-${record.status}`} record={record} entity={entity} />
  else if (view === 'checking') body = <CheckingState title={t('imports.map.checking')} body={t('imports.map.checkingBody')} />
  else if (view === 'review') body = <ReviewStep record={record} onEditMapping={() => setEditing(true)} />
  else if (view === 'importing')
    body = (
      <CheckingState
        title={t('imports.review.importing')}
        body={t('imports.review.importingBody', { n: count(record.quality_report?.rows_valid ?? record.rows_total) })}
      />
    )
  else if (view === 'done') body = <DoneState record={record} />
  else body = <FailedState record={record} onEdit={() => setEditing(true)} />

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link to="/imports" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted hover:text-fg sm:min-h-0">
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t('imports.wizard.back')}
      </Link>
      <PageHeader title={t('imports.wizard.title')} />
      <div className="surface-raised flex flex-col gap-6 rounded-xl p-5 sm:p-7">
        <div className="flex flex-col gap-5">
          <WizardStepsHeader step={step} title={t(titles[step][0])} body={t(titles[step][1])} />
          {record && <FileBadge record={record} entity={entity} />}
        </div>
        <div key={view} className="anim-page">
          {body}
        </div>
      </div>
    </div>
  )
}


function WizardStepsHeader({ step, title, body }: { step: number; title: string; body: string }) {
  return (
    <>
      <WizardSteps step={step} />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </>
  )
}

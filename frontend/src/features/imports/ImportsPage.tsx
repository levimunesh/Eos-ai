import { Check, FileUp, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useEntitiesQuery, useImportsQuery } from './api'
import { count, relativeTime, statusLabel, statusTone } from './format'
import { sortEntities, type EntityType, type ImportSummary } from './types'

export function StatusPill({ status }: { status: ImportSummary['status'] }) {
  const busy = status === 'validating' || status === 'importing'
  return (
    <Badge tone={statusTone(status)} dot>
      <span className={cn(busy && 'motion-safe:animate-pulse')}>{statusLabel(status)}</span>
    </Badge>
  )
}

/** The recommended import order, with "import X first" hints from depends_on. */
export function ImportOrder({ entities, done }: { entities: EntityType[]; done: Set<string> }) {
  const { isOwner } = useOrg()
  const visible = sortEntities(entities).filter((e) => isOwner || !e.owner_only)
  const labels = new Map(entities.map((e) => [e.key, e.label]))
  return (
    <ol className="flex flex-col">
      {visible.map((e, i) => {
        const missing = e.depends_on.filter((d) => !done.has(d))
        const isDone = done.has(e.key)
        return (
          <li key={e.key} className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <span aria-hidden className="mono mt-0.5 w-4 shrink-0 text-end text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-body font-medium">
                {e.label}
                {isDone && (
                  <span className="inline-flex items-center gap-1 text-caption font-normal text-success">
                    <Check aria-hidden className="size-3" strokeWidth={2.5} />
                    {t('imports.status.done')}
                  </span>
                )}
                {e.owner_only && (
                  <Badge tone="outline">
                    <Lock aria-hidden className="size-3" />
                    {t('imports.ownerOnly')}
                  </Badge>
                )}
              </p>
              <p className="text-body text-muted">{e.description}</p>
              {missing.length > 0 && !isDone && (
                <p className="mt-0.5 text-caption text-warning">
                  {t('imports.needsFirst', { deps: missing.map((d) => labels.get(d) ?? d).join(', ') })}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ImportsPage() {
  const { role } = useOrg()
  if (role === 'viewer') {
    return <PageHeader title={t('imports.title')} description={t('imports.viewerNoAccess')} />
  }
  return <ImportsContent />
}

function ImportsContent() {
  const imports = useImportsQuery()
  const entities = useEntitiesQuery()
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  const labels = useMemo(() => new Map((entities.data ?? []).map((e) => [e.key, e.label])), [entities.data])
  const done = useMemo(
    () => new Set((imports.data ?? []).filter((i) => i.status === 'done').map((i) => i.entity_type)),
    [imports.data],
  )

  const newButton = (
    <Link to="/imports/new" className={buttonVariants()}>
      <FileUp aria-hidden />
      {t('imports.newImport')}
    </Link>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('imports.title')} description={t('imports.description')} actions={newButton} />

      <Card>
        {imports.isPending ? (
          <LoadingBlock />
        ) : imports.isError ? (
          <ErrorBlock error={imports.error} onRetry={() => void imports.refetch()} />
        ) : imports.data.length === 0 ? (
          <EmptyState icon={FileUp} title={t('imports.emptyTitle')} body={t('imports.emptyBody')} action={newButton} />
        ) : (
          <Table aria-label={t('imports.historyLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('imports.colFile')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('imports.colType')}</TableHead>
                <TableHead>{t('imports.colStatus')}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t('imports.colRows')}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t('imports.colWhen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.data.map((i) => (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/imports/new?id=${i.id}`)}
                >
                  <TableCell className="max-w-[20rem]">
                    <Link
                      to={`/imports/new?id=${i.id}`}
                      aria-label={t('imports.openImport', { file: i.file_name })}
                      className="mono block truncate text-fg hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {i.file_name}
                    </Link>
                    <span className="block truncate text-caption text-muted md:hidden">
                      {labels.get(i.entity_type) ?? i.entity_type}
                      <span className="lg:hidden">, {relativeTime(i.created_at, now)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-fg-2 md:table-cell">{labels.get(i.entity_type) ?? i.entity_type}</TableCell>
                  <TableCell>
                    <StatusPill status={i.status} />
                  </TableCell>
                  <TableCell className="num hidden text-end sm:table-cell">
                    {i.rows_total == null ? (
                      <span className="text-muted">{'–'}</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>
                          {i.status === 'done'
                            ? t('imports.rowsSummary', { imported: count(i.rows_imported) })
                            : count(i.rows_total)}
                        </span>
                        {(i.rows_rejected ?? 0) + (i.rows_duplicate ?? 0) > 0 && (
                          <span className="text-caption text-muted">
                            {[
                              i.rows_rejected ? t('imports.rowsRejected', { n: count(i.rows_rejected) }) : null,
                              i.rows_duplicate ? t('imports.rowsDuplicate', { n: count(i.rows_duplicate) }) : null,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="mono hidden text-end whitespace-nowrap text-fg-2 lg:table-cell" title={new Date(i.created_at).toLocaleString()}>
                    {relativeTime(i.created_at, now)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {entities.data && (
        <Card>
          <CardHeader>
            <CardTitle>{t('imports.orderTitle')}</CardTitle>
          </CardHeader>
          <ImportOrder entities={entities.data} done={done} />
        </Card>
      )}
    </div>
  )
}

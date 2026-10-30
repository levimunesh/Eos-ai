import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ErrorBlock, InlineError, LoadingBlock, PageHeader, Spinner } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrg } from '@/features/orgs/org-context'
import { useBranchesQuery, useUpdateBranch } from '@/lib/queries'
import { t } from '@/lib/strings'
import type { Branch } from '@/lib/types'
import { CreateBranchDialog, EditBranchDialog } from './BranchDialogs'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'signal' : 'neutral'}>
      <span aria-hidden className={active ? 'size-1.5 rounded-full bg-signal' : 'size-1.5 rounded-full bg-muted'} />
      {active ? t('branches.active') : t('branches.inactive')}
    </Badge>
  )
}

export function BranchesPage() {
  const { isOwner } = useOrg()
  const branches = useBranchesQuery()
  const toggle = useUpdateBranch()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)

  const addButton = isOwner ? (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      {t('branches.add')}
    </Button>
  ) : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('branches.title')}
        description={isOwner ? t('branches.description') : t('branches.descriptionScoped')}
        actions={addButton ?? <Badge tone="outline">{t('common.readOnly')}</Badge>}
      />

      {toggle.error ? <InlineError error={toggle.error} /> : null}

      <Card>
        {branches.isPending ? (
          <LoadingBlock />
        ) : branches.isError ? (
          <ErrorBlock error={branches.error} onRetry={() => void branches.refetch()} />
        ) : branches.data.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-10">
            <h2 className="text-base font-semibold">{t('branches.emptyTitle')}</h2>
            <p className="max-w-[60ch] text-sm text-muted">
              {isOwner ? t('branches.emptyOwner') : t('branches.emptyViewer')}
            </p>
            {addButton}
          </div>
        ) : (
          <Table aria-label={t('branches.tableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('branches.colCode')}</TableHead>
                <TableHead>{t('branches.colName')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('branches.colCity')}</TableHead>
                <TableHead>{t('branches.colStatus')}</TableHead>
                {isOwner && <TableHead className="text-end">{t('branches.colActions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.data.map((b) => {
                const pending = toggle.isPending && toggle.variables?.id === b.id
                return (
                  <TableRow key={b.id} className={b.is_active ? undefined : 'text-muted'}>
                    <TableCell className="font-medium whitespace-nowrap">{b.code}</TableCell>
                    <TableCell>
                      <span className={b.is_active ? undefined : 'text-muted'}>{b.name}</span>
                      {b.city && <span className="block text-xs text-muted sm:hidden">{b.city}</span>}
                    </TableCell>
                    <TableCell className="hidden text-ink-2 sm:table-cell">{b.city ?? ''}</TableCell>
                    <TableCell>
                      <StatusBadge active={b.is_active} />
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => toggle.mutate({ id: b.id, body: { is_active: !b.is_active } })}
                          >
                            {pending && <Spinner />}
                            {b.is_active ? t('branches.deactivate') : t('branches.activate')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${t('common.edit')} ${b.name}`}
                            onClick={() => setEditing(b)}
                          >
                            <Pencil />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {isOwner && (
        <>
          <CreateBranchDialog open={creating} onOpenChange={setCreating} />
          <EditBranchDialog branch={editing} onClose={() => setEditing(null)} />
        </>
      )}
    </div>
  )
}

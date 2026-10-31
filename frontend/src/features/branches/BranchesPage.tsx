import { Pencil, Plus, Power, Store } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { RowActionsMenu } from '@/components/RowActions'
import { EmptyState, ErrorBlock, InlineError, LoadingBlock, PageHeader, Spinner } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrg } from '@/features/orgs/org-context'
import { useBranchesQuery, useUpdateBranch } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import type { Branch } from '@/lib/types'
import { CreateBranchDialog, EditBranchDialog } from './BranchDialogs'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'} dot>
      {active ? t('branches.active') : t('branches.inactive')}
    </Badge>
  )
}

export function BranchesPage() {
  const { isOwner } = useOrg()
  const branches = useBranchesQuery()
  const toggle = useUpdateBranch()
  const [editing, setEditing] = useState<Branch | null>(null)
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  // Open state lives in the URL (?new=1) so the command palette can open this dialog.
  const creating = isOwner && params.get('new') === '1'
  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('new', '1')
    else next.delete('new')
    setParams(next, { replace: true })
  }

  const addButton = isOwner ? (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      {t('branches.add')}
    </Button>
  ) : undefined

  return (
    <div className="flex flex-col gap-4">
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
          <EmptyState
            icon={Store}
            title={t('branches.emptyTitle')}
            body={isOwner ? t('branches.emptyOwner') : t('branches.emptyViewer')}
            action={addButton}
          />
        ) : (
          <Table aria-label={t('branches.tableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">{t('branches.colCode')}</TableHead>
                <TableHead>{t('branches.colName')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('branches.colCity')}</TableHead>
                <TableHead>{t('branches.colStatus')}</TableHead>
                {isOwner && <TableHead className="text-end">{t('branches.colActions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.data.map((b) => {
                const pending = toggle.isPending && toggle.variables?.id === b.id
                const flip = () =>
                  toggle.mutate(
                    { id: b.id, body: { is_active: !b.is_active } },
                    {
                      onSuccess: (updated) =>
                        toast.success(
                          t(updated.is_active ? 'branches.activated' : 'branches.deactivated', { code: updated.code }),
                        ),
                    },
                  )
                return (
                  <TableRow key={b.id} className={b.is_active ? undefined : 'text-muted'}>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      <span className="mono text-fg">{b.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className={b.is_active ? 'font-medium sm:font-normal' : 'text-muted'}>{b.name}</span>
                      <span className="mono block text-muted sm:hidden">
                        {b.code}
                        {b.city && `, ${b.city}`}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-fg-2 sm:table-cell">{b.city ?? ''}</TableCell>
                    <TableCell>
                      <StatusBadge active={b.is_active} />
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-end whitespace-nowrap">
                        <RowActionsMenu
                          label={`${t('common.moreActions')}: ${b.name}`}
                          actions={[
                            { label: t('common.edit'), icon: Pencil, onSelect: () => setEditing(b) },
                            {
                              label: b.is_active ? t('branches.deactivate') : t('branches.activate'),
                              icon: Power,
                              onSelect: flip,
                              disabled: pending,
                            },
                          ]}
                        />
                        <div className="hidden items-center gap-1 sm:inline-flex">
                          <Button variant="ghost" size="sm" disabled={pending} onClick={flip}>
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

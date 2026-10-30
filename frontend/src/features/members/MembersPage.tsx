import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErrorBlock, LoadingBlock, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrg } from '@/features/orgs/org-context'
import { formatDate } from '@/lib/format'
import {
  useBranchesQuery,
  useInvitationsQuery,
  useMembersQuery,
  useOrgQuery,
  useRemoveMember,
  useRevokeInvitation,
} from '@/lib/queries'
import { t } from '@/lib/strings'
import type { Invitation, Member, Role } from '@/lib/types'
import { accessSummary } from './access'
import { ConfirmDialog, EditAccessDialog, InviteDialog } from './MemberDialogs'

const ROLE_TONE: Record<Role, 'petrol' | 'neutral' | 'outline'> = {
  owner: 'petrol',
  manager: 'neutral',
  viewer: 'outline',
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONE[role]}>{t(`roles.${role}`)}</Badge>
}

function isPending(inv: Invitation, now: number) {
  return !inv.accepted_at && !inv.revoked_at && new Date(inv.expires_at).getTime() > now
}

export function MembersPage() {
  const { role } = useOrg()
  // The member list includes everyone's email; the API only serves it to owners and managers.
  if (role === 'viewer') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('members.title')} description={t('members.viewerNoAccess')} />
      </div>
    )
  }
  return <MembersContent />
}

function MembersContent() {
  const { isOwner, me } = useOrg()
  const members = useMembersQuery()
  const branches = useBranchesQuery()
  const org = useOrgQuery()
  const invitations = useInvitationsQuery(isOwner)
  const remove = useRemoveMember()
  const revoke = useRevokeInvitation()

  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [revoking, setRevoking] = useState<Invitation | null>(null)
  const [now] = useState(() => Date.now())

  const branchNames = useMemo(
    () => new Map((branches.data ?? []).map((b) => [b.id, b.code] as const)),
    [branches.data],
  )
  const pendingInvites = useMemo(
    () => (invitations.data ?? []).filter((i) => isPending(i, now)),
    [invitations.data, now],
  )
  const dateFmt = org.data?.date_format
  const tz = org.data?.timezone

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('members.title')}
        description={t('members.description')}
        actions={
          isOwner ? (
            <Button onClick={() => setInviting(true)}>
              <UserPlus aria-hidden />
              {t('members.invite')}
            </Button>
          ) : (
            <Badge tone="outline">{t('common.readOnly')}</Badge>
          )
        }
      />

      <Card>
        {members.isPending ? (
          <LoadingBlock />
        ) : members.isError ? (
          <ErrorBlock error={members.error} onRetry={() => void members.refetch()} />
        ) : members.data.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{t('members.empty')}</p>
        ) : (
          <Table aria-label={t('members.tableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('members.colName')}</TableHead>
                <TableHead>{t('members.colRole')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('members.colAccess')}</TableHead>
                {isOwner && <TableHead className="text-end">{t('members.colActions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data.map((m) => {
                const access = accessSummary(m.all_branches, m.branch_ids, branchNames)
                const isMe = m.user_id === me.id
                return (
                  <TableRow key={m.membership_id}>
                    <TableCell className="max-w-[16rem]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{m.full_name || m.email}</span>
                        {isMe && <Badge tone="outline">{t('common.you')}</Badge>}
                      </div>
                      {m.full_name && <span className="block truncate text-xs text-muted">{m.email}</span>}
                      <span className="block truncate text-xs text-muted md:hidden" title={access.title}>
                        {access.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={m.role} />
                    </TableCell>
                    <TableCell className="hidden text-ink-2 md:table-cell" title={access.title}>
                      {access.label}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(m)}
                            aria-label={`${t('members.editAction')}: ${m.full_name || m.email}`}
                          >
                            <Pencil aria-hidden />
                            <span className="hidden sm:inline">{t('members.editAction')}</span>
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="icon-sm"
                            onClick={() => {
                              remove.reset()
                              setRemoving(m)
                            }}
                            aria-label={`${t('common.remove')} ${m.full_name || m.email}`}
                          >
                            <Trash2 />
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
        <Card>
          <CardHeader>
            <CardTitle>{t('invitations.title')}</CardTitle>
          </CardHeader>
          {invitations.isPending ? (
            <LoadingBlock />
          ) : invitations.isError ? (
            <ErrorBlock error={invitations.error} onRetry={() => void invitations.refetch()} />
          ) : pendingInvites.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">{t('invitations.empty')}</p>
          ) : (
            <Table aria-label={t('invitations.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invitations.colEmail')}</TableHead>
                  <TableHead>{t('invitations.colRole')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('invitations.colAccess')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('invitations.colExpires')}</TableHead>
                  <TableHead className="text-end">{t('members.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((inv) => {
                  const access = accessSummary(inv.all_branches, inv.branch_ids, branchNames)
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="max-w-[16rem] truncate">{inv.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={inv.role} />
                      </TableCell>
                      <TableCell className="hidden text-ink-2 md:table-cell" title={access.title}>
                        {access.label}
                      </TableCell>
                      <TableCell className="hidden text-ink-2 tabular-nums sm:table-cell">
                        {formatDate(inv.expires_at, dateFmt, tz)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => {
                            revoke.reset()
                            setRevoking(inv)
                          }}
                        >
                          {t('invitations.revoke')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {isOwner && (
        <>
          <InviteDialog open={inviting} onOpenChange={setInviting} branches={branches.data ?? []} />
          <EditAccessDialog member={editing} branches={branches.data ?? []} onClose={() => setEditing(null)} />
          <ConfirmDialog
            open={!!removing}
            title={t('members.removeTitle', { name: removing?.full_name || removing?.email || '' })}
            body={t('members.removeBody')}
            confirmLabel={t('members.removeAction')}
            pendingLabel={t('members.removing')}
            pending={remove.isPending}
            error={remove.error}
            onClose={() => setRemoving(null)}
            onConfirm={() => removing && remove.mutate(removing.membership_id, { onSuccess: () => setRemoving(null) })}
          />
          <ConfirmDialog
            open={!!revoking}
            title={t('invitations.revokeTitle', { email: revoking?.email ?? '' })}
            body={t('invitations.revokeBody')}
            confirmLabel={t('invitations.revoke')}
            pendingLabel={t('invitations.revoking')}
            pending={revoke.isPending}
            error={revoke.error}
            onClose={() => setRevoking(null)}
            onConfirm={() => revoking && revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) })}
          />
        </>
      )}
    </div>
  )
}

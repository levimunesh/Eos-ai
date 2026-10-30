import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { InlineError } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useCreateInvitation, useUpdateMember } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import type { Branch, InvitationCreated, Member } from '@/lib/types'
import { inviteLink } from './access'
import { AccessFields } from './AccessFields'
import { accessSchema, inviteSchema, type AccessValues, type InviteValues } from './schemas'

export function EditAccessDialog({
  member,
  branches,
  onClose,
}: {
  member: Member | null
  branches: Branch[]
  onClose: () => void
}) {
  const update = useUpdateMember()
  const toast = useToast()
  const form = useForm<AccessValues>({
    resolver: zodResolver(accessSchema),
    defaultValues: { role: 'viewer', allBranches: true, branchIds: [] },
  })
  const allBranches = useWatch({ control: form.control, name: 'allBranches' })

  useEffect(() => {
    if (member) {
      form.reset({ role: member.role, allBranches: member.all_branches, branchIds: member.branch_ids })
      update.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member])

  const submit = form.handleSubmit(async (v) => {
    if (!member) return
    const body: { role?: Member['role']; all_branches?: boolean; branch_ids?: string[] } = {}
    if (v.role !== member.role) body.role = v.role
    const scopeChanged =
      v.allBranches !== member.all_branches ||
      (!v.allBranches && [...v.branchIds].sort().join() !== [...member.branch_ids].sort().join())
    if (scopeChanged) {
      body.all_branches = v.allBranches
      body.branch_ids = v.allBranches ? [] : v.branchIds
    }
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }
    try {
      await update.mutateAsync({ id: member.membership_id, body })
      toast.success(t('members.updated', { name: member.full_name || member.email }))
      onClose()
    } catch {
      // update.error
    }
  })

  const name = member?.full_name || member?.email || ''

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{t('members.editTitle', { name })}</DialogTitle>
            <DialogDescription>{member?.email}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <AccessFields
              control={form.control}
              errors={form.formState.errors}
              branches={branches}
              idPrefix="edit"
              allBranches={allBranches}
            />
            <InlineError error={update.error} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="invite-link" className="text-sm font-medium">
        {t('invitations.linkLabel')}
      </label>
      <div className="flex gap-2">
        <Input id="invite-link" readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="text-xs" dir="ltr" />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            } catch {
              document.getElementById('invite-link')?.focus()
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
    </div>
  )
}

export function InviteDialog({
  open,
  onOpenChange,
  branches,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  branches: Branch[]
}) {
  // The content unmounts when closed, so each opening starts with a fresh form and mutation.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <InviteDialogContent branches={branches} />
      </DialogContent>
    </Dialog>
  )
}

function InviteDialogContent({ branches }: { branches: Branch[] }) {
  const create = useCreateInvitation()
  const [created, setCreated] = useState<InvitationCreated | null>(null)
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'viewer', allBranches: true, branchIds: [] },
  })
  const allBranches = useWatch({ control: form.control, name: 'allBranches' })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (v) => {
    try {
      const inv = await create.mutateAsync({
        email: v.email,
        role: v.role,
        all_branches: v.allBranches,
        branch_ids: v.allBranches ? [] : v.branchIds,
      })
      setCreated(inv)
    } catch {
      // create.error
    }
  })

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('invitations.createdTitle')}</DialogTitle>
          <DialogDescription>{t('invitations.createdBody', { email: created.email })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <CopyField value={inviteLink(created.token)} />
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('invitations.emailNotBuilt')}
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{t('invitations.done')}</Button>
          </DialogClose>
        </DialogFooter>
      </>
    )
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{t('invitations.dialogTitle')}</DialogTitle>
        <DialogDescription>{t('invitations.dialogBody')}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-5">
        <Field id="invite-email" label={t('invitations.email')} error={errors.email?.message}>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            aria-invalid={!!errors.email}
            aria-describedby={describedBy('invite-email', errors.email?.message)}
            {...form.register('email')}
          />
        </Field>
        <AccessFields
          control={form.control as unknown as Control<AccessValues>}
          errors={errors as FieldErrors<AccessValues>}
          branches={branches}
          idPrefix="invite"
          allBranches={allBranches}
        />
        <InlineError error={create.error} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('invitations.sending') : t('invitations.send')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  pendingLabel: string
  pending: boolean
  error: unknown
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <InlineError error={error} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t('common.cancel')}</Button>
          </DialogClose>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

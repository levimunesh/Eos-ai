import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { useCreateBranch, useUpdateBranch } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import type { Branch } from '@/lib/types'
import {
  branchCreateSchema,
  branchEditSchema,
  type BranchCreateValues,
  type BranchEditValues,
} from './schemas'

export function CreateBranchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateBranch()
  const toast = useToast()
  const form = useForm<BranchCreateValues>({
    resolver: zodResolver(branchCreateSchema),
    defaultValues: { code: '', name: '', city: '' },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (open) {
      form.reset({ code: '', name: '', city: '' })
      create.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = form.handleSubmit(async (v) => {
    try {
      const branch = await create.mutateAsync({ code: v.code, name: v.name, city: v.city || null })
      toast.success(t('branches.created', { code: branch.code }))
      onOpenChange(false)
    } catch {
      // create.error
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{t('branches.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field id="branch-code" label={t('branches.code')} hint={t('branches.codeHint')} error={errors.code?.message}>
              <Input
                id="branch-code"
                autoComplete="off"
                aria-invalid={!!errors.code}
                aria-describedby={describedBy('branch-code', errors.code?.message, true)}
                {...form.register('code')}
              />
            </Field>
            <Field id="branch-name" label={t('branches.name')} error={errors.name?.message}>
              <Input
                id="branch-name"
                aria-invalid={!!errors.name}
                aria-describedby={describedBy('branch-name', errors.name?.message)}
                {...form.register('name')}
              />
            </Field>
            <Field
              id="branch-city"
              label={
                <>
                  {t('branches.city')} <span className="font-normal text-muted">({t('common.optional')})</span>
                </>
              }
              error={errors.city?.message}
            >
              <Input
                id="branch-city"
                aria-invalid={!!errors.city}
                aria-describedby={describedBy('branch-city', errors.city?.message)}
                {...form.register('city')}
              />
            </Field>
            <InlineError error={create.error} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('branches.creating') : t('branches.createAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditBranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const update = useUpdateBranch()
  const toast = useToast()
  const form = useForm<BranchEditValues>({ resolver: zodResolver(branchEditSchema), defaultValues: { name: '', city: '' } })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (branch) {
      form.reset({ name: branch.name, city: branch.city ?? '' })
      update.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch])

  const submit = form.handleSubmit(async (v) => {
    if (!branch) return
    try {
      await update.mutateAsync({ id: branch.id, body: { name: v.name, city: v.city || null } })
      toast.success(t('branches.updated', { code: branch.code }))
      onClose()
    } catch {
      // update.error
    }
  })

  return (
    <Dialog open={!!branch} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{t('branches.editTitle', { name: branch?.name ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('branches.code')}: <span className="font-medium text-fg">{branch?.code}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field id="edit-branch-name" label={t('branches.name')} error={errors.name?.message}>
              <Input
                id="edit-branch-name"
                aria-invalid={!!errors.name}
                aria-describedby={describedBy('edit-branch-name', errors.name?.message)}
                {...form.register('name')}
              />
            </Field>
            <Field id="edit-branch-city" label={t('branches.city')} error={errors.city?.message}>
              <Input
                id="edit-branch-city"
                aria-invalid={!!errors.city}
                aria-describedby={describedBy('edit-branch-city', errors.city?.message)}
                {...form.register('city')}
              />
            </Field>
            <InlineError error={update.error} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

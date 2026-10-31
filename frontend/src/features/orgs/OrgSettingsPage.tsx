import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, Lock } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { ErrorBlock, InlineError, LoadingBlock, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currencyName } from '@/lib/currencies'
import { decimalStringToPercent } from '@/lib/percent'
import { useOrgQuery, useUpdateOrgSettings } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import type { Org } from '@/lib/types'
import { OrgSettingsFields } from './OrgFields'
import { useOrg } from './org-context'
import { orgSettingsSchema, toSettingsPayload, type OrgSettingsValues } from './schemas'

function toValues(org: Org): OrgSettingsValues {
  return {
    name: org.name,
    timezone: org.timezone,
    taxRatePercent: decimalStringToPercent(org.tax_rate),
    pricesIncludeTax: org.prices_include_tax,
    fiscalYearStartMonth: String(org.fiscal_year_start_month),
    dateFormat: org.date_format,
  }
}

function SettingsForm({ org, canEdit }: { org: Org; canEdit: boolean }) {
  const update = useUpdateOrgSettings()
  const toast = useToast()
  const form = useForm<OrgSettingsValues>({ resolver: zodResolver(orgSettingsSchema), defaultValues: toValues(org) })
  const { errors, isDirty, isSubmitting } = form.formState

  useEffect(() => {
    form.reset(toValues(org))
  }, [org, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(toSettingsPayload(values))
      toast.success(t('org.savedToast'))
    } catch {
      // Rendered via update.error.
    }
  })

  return (
    <Card>
      <form noValidate onSubmit={submit}>
        <CardContent className="flex flex-col gap-5 py-5">
          <Field id="name" label={t('onboarding.name')} error={errors.name?.message}>
            <Input
              id="name"
              disabled={!canEdit}
              aria-invalid={!!errors.name}
              aria-describedby={describedBy('name', errors.name?.message)}
              {...form.register('name')}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseCurrency">{t('onboarding.currency')}</Label>
            <div
              id="baseCurrency"
              aria-describedby="baseCurrency-note"
              className="flex h-10 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-body sm:h-9"
            >
              <Lock aria-hidden className="size-3.5 text-muted" />
              <span className="font-medium">{org.base_currency}</span>
              <span className="truncate text-muted">{currencyName(org.base_currency)}</span>
              <span className="ms-auto text-caption whitespace-nowrap text-muted">
                {t('org.decimals', { count: org.currency_decimals })}
              </span>
            </div>
            <p id="baseCurrency-note" className="text-caption text-muted">
              {t('org.currencyFixed')}
            </p>
          </div>

          <OrgSettingsFields
            control={form.control}
            register={form.register}
            errors={errors}
            disabled={!canEdit}
            currentTimezone={org.timezone}
          />

          <InlineError error={update.error} />
        </CardContent>
        {canEdit && (
          <CardFooter>
            {update.isSuccess && !isDirty && (
              <span role="status" className="me-auto flex items-center gap-1.5 text-body text-success">
                <CircleCheck aria-hidden className="size-4" />
                {t('common.saved')}
              </span>
            )}
            <Button variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => form.reset(toValues(org))}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  )
}

export function OrgSettingsPage() {
  const { isOwner } = useOrg()
  const org = useOrgQuery()
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('org.title')}
        description={t('org.description')}
        actions={!isOwner ? <Badge tone="outline">{t('common.readOnly')}</Badge> : undefined}
      />
      {!isOwner && <p className="-mt-2 text-body text-muted">{t('org.ownerOnly')}</p>}
      {org.isPending ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : org.isError ? (
        <Card>
          <ErrorBlock error={org.error} onRetry={() => void org.refetch()} />
        </Card>
      ) : (
        <SettingsForm org={org.data} canEdit={isOwner} />
      )}
    </div>
  )
}

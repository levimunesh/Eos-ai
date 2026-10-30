import { zodResolver } from '@hookform/resolvers/zod'
import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, type Control, type UseFormRegister } from 'react-hook-form'
import { InlineError } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { currencyOptions } from '@/lib/currencies'
import { t } from '@/lib/strings'
import { browserTimezone } from '@/lib/timezones'
import type { OrgCreate } from '@/lib/types'
import { OrgSettingsFields } from './OrgFields'
import { onboardingSchema, toOrgPayload, type OnboardingValues, type OrgSettingsValues } from './schemas'

interface Props {
  onSubmit: (payload: OrgCreate) => Promise<unknown> | void
  error?: unknown
}

export function OnboardingForm({ onSubmit, error }: Props) {
  const options = useMemo(() => currencyOptions(), [])
  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      baseCurrency: '',
      timezone: browserTimezone(),
      taxRatePercent: '0',
      pricesIncludeTax: false,
      fiscalYearStartMonth: '1',
      dateFormat: 'DD/MM/YYYY',
    },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(toOrgPayload(values))
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <Field id="name" label={t('onboarding.name')} error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="organization"
          placeholder={t('onboarding.namePlaceholder')}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy('name', errors.name?.message)}
          {...form.register('name')}
        />
      </Field>

      <div className="flex flex-col gap-1.5 rounded-md border border-line bg-sunken/50 p-4">
        <Field id="baseCurrency" label={t('onboarding.currency')} error={errors.baseCurrency?.message}>
          <Controller
            control={form.control}
            name="baseCurrency"
            render={({ field }) => (
              <Combobox
                id="baseCurrency"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={options}
                placeholder={t('onboarding.currencyPlaceholder')}
                invalid={!!errors.baseCurrency}
                aria-describedby="baseCurrency-lock"
              />
            )}
          />
        </Field>
        <p id="baseCurrency-lock" className="flex items-start gap-1.5 text-xs text-ink-2">
          <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
          {t('onboarding.currencyHint')}
        </p>
      </div>

      <OrgSettingsFields
        control={form.control as unknown as Control<OrgSettingsValues>}
        register={form.register as unknown as UseFormRegister<OrgSettingsValues>}
        errors={errors}
      />

      <InlineError error={error} />

      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? t('onboarding.submitting') : t('onboarding.submit')}
        </Button>
      </div>
    </form>
  )
}

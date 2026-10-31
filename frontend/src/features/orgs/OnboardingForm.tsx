import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Check, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, type Control, type UseFormRegister } from 'react-hook-form'
import { InlineError } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { currencyOptions } from '@/lib/currencies'
import { t, type StringKey } from '@/lib/strings'
import { browserTimezone } from '@/lib/timezones'
import type { OrgCreate } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RegionFields, TaxFields } from './OrgFields'
import { onboardingSchema, toOrgPayload, type OnboardingValues, type OrgSettingsValues } from './schemas'

interface Props {
  onSubmit: (payload: OrgCreate) => Promise<unknown> | void
  error?: unknown
  /** Start on a later step (used for previews); defaults to the first. */
  initialStep?: number
}

const STEPS: { title: StringKey; body: StringKey; fields: (keyof OnboardingValues)[] }[] = [
  { title: 'onboarding.steps.company', body: 'onboarding.steps.companyBody', fields: ['name'] },
  { title: 'onboarding.steps.region', body: 'onboarding.steps.regionBody', fields: ['baseCurrency', 'timezone', 'dateFormat'] },
  {
    title: 'onboarding.steps.tax',
    body: 'onboarding.steps.taxBody',
    fields: ['taxRatePercent', 'pricesIncludeTax', 'fiscalYearStartMonth'],
  },
]

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption font-medium text-muted tabular-nums">
        {t('common.stepOf', { step: step + 1, total: STEPS.length })}
      </p>
      <ol aria-label={t('onboarding.progress')} className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden
              className={cn(
                'h-1 rounded-full transition-colors duration-300',
                i <= step ? 'bg-[image:var(--dawn)]' : 'bg-line',
              )}
            />
            <span className={cn('flex items-center gap-1.5 text-caption', i === step ? 'font-medium text-fg' : 'text-muted')}>
              {i < step && <Check aria-hidden className="size-3 text-success" strokeWidth={3} />}
              <span className="truncate">{t(s.title)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function OnboardingForm({ onSubmit, error, initialStep = 0 }: Props) {
  const options = useMemo(() => currencyOptions(), [])
  const [step, setStep] = useState(initialStep)
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
  const last = step === STEPS.length - 1
  const shared = {
    control: form.control as unknown as Control<OrgSettingsValues>,
    register: form.register as unknown as UseFormRegister<OrgSettingsValues>,
    errors,
  }

  const next = async () => {
    if (await form.trigger(STEPS[step].fields, { shouldFocus: true })) setStep((s) => s + 1)
  }

  const submit = form.handleSubmit(
    async (values) => {
      await onSubmit(toOrgPayload(values))
    },
    (errs) => {
      // Jump back to the first step that has an error.
      const target = STEPS.findIndex((s) => s.fields.some((f) => f in errs))
      if (target >= 0 && target !== step) setStep(target)
    },
  )

  return (
    <form
      noValidate
      onSubmit={(e) => {
        if (!last) {
          e.preventDefault()
          void next()
          return
        }
        void submit(e)
      }}
      className="flex flex-col gap-7"
    >
      <Stepper step={step} />

      <div key={step} className="anim-page flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{t(STEPS[step].title)}</h2>
          <p className="text-body text-muted">{t(STEPS[step].body)}</p>
        </div>

        {step === 0 && (
          <Field id="name" label={t('onboarding.name')} error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="organization"
              autoFocus
              placeholder={t('onboarding.namePlaceholder')}
              aria-invalid={!!errors.name}
              aria-describedby={describedBy('name', errors.name?.message)}
              {...form.register('name')}
            />
          </Field>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
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
              <p id="baseCurrency-lock" className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2.5 py-2 text-caption text-warning">
                <Lock aria-hidden className="mt-px size-3 shrink-0" />
                {t('onboarding.currencyHint')}
              </p>
            </div>
            <RegionFields {...shared} />
          </>
        )}

        {step === 2 && <TaxFields {...shared} />}
      </div>

      <InlineError error={error} />

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
            {t('common.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={isSubmitting} className="sm:min-w-40">
          {last ? (isSubmitting ? t('onboarding.submitting') : t('onboarding.submit')) : t('common.continue')}
        </Button>
      </div>
    </form>
  )
}

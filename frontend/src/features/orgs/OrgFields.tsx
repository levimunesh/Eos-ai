import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { monthName, t } from '@/lib/strings'
import { timezoneOptions } from '@/lib/timezones'
import { DATE_FORMATS } from '@/lib/types'
import type { OrgSettingsValues } from './schemas'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

interface Props {
  control: Control<OrgSettingsValues>
  register: UseFormRegister<OrgSettingsValues>
  errors: FieldErrors<OrgSettingsValues>
  disabled?: boolean
  currentTimezone?: string
}

/** Timezone and date format. */
export function RegionFields({ control, register, errors, disabled, currentTimezone }: Props) {
  const tzOptions = timezoneOptions(currentTimezone)
  return (
    <>
      <Field id="timezone" label={t('onboarding.timezone')} hint={t('onboarding.timezoneHint')} error={errors.timezone?.message}>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Combobox
              id="timezone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={tzOptions}
              disabled={disabled}
              invalid={!!errors.timezone}
              aria-describedby={describedBy('timezone', errors.timezone?.message, true)}
            />
          )}
        />
      </Field>
      <Field id="dateFormat" label={t('onboarding.dateFormat')}>
        <Select id="dateFormat" disabled={disabled} {...register('dateFormat')}>
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}

/** Tax rate, tax-inclusive prices and fiscal year start. */
export function TaxFields({ control, register, errors, disabled }: Props) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="taxRatePercent" label={t('onboarding.taxRate')} hint={t('onboarding.taxRateHint')} error={errors.taxRatePercent?.message}>
          <Input
            id="taxRatePercent"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={!!errors.taxRatePercent}
            aria-describedby={describedBy('taxRatePercent', errors.taxRatePercent?.message, true)}
            className="tabular-nums"
            {...register('taxRatePercent')}
          />
        </Field>
        <Field id="fiscalYearStartMonth" label={t('onboarding.fiscalMonth')}>
          <Select id="fiscalYearStartMonth" disabled={disabled} {...register('fiscalYearStartMonth')}>
            {MONTHS.map((m) => (
              <option key={m} value={String(m)}>
                {monthName(m)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Controller
        control={control}
        name="pricesIncludeTax"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2/50 p-3.5">
            <Checkbox
              id="pricesIncludeTax"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              disabled={disabled}
              aria-describedby="pricesIncludeTax-hint"
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="pricesIncludeTax">{t('onboarding.pricesIncludeTax')}</Label>
              <p id="pricesIncludeTax-hint" className="text-caption text-muted">
                {t('onboarding.pricesIncludeTaxHint')}
              </p>
            </div>
          </div>
        )}
      />
    </>
  )
}

export function OrgSettingsFields(props: Props) {
  return (
    <>
      <RegionFields {...props} />
      <TaxFields {...props} />
    </>
  )
}

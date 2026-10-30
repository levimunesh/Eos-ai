import { z } from 'zod'
import { CURRENCY_CODES } from '@/lib/currencies'
import { PERCENT_PATTERN, percentToDecimalString } from '@/lib/percent'
import { t } from '@/lib/strings'
import { DATE_FORMATS, type OrgCreate, type OrgSettingsUpdate } from '@/lib/types'

const currencySet = new Set<string>(CURRENCY_CODES)

const shared = {
  name: z.string().trim().min(2, t('onboarding.v.name')).max(200, t('onboarding.v.name')),
  timezone: z.string().min(1, t('onboarding.v.timezone')),
  taxRatePercent: z
    .string()
    .trim()
    .regex(PERCENT_PATTERN, t('onboarding.v.taxRate')),
  pricesIncludeTax: z.boolean(),
  fiscalYearStartMonth: z.string().regex(/^(?:[1-9]|1[0-2])$/),
  dateFormat: z.enum(DATE_FORMATS),
}

/** Form values are kept as strings so inputs stay controlled; conversion happens in toOrgPayload. */
export const onboardingSchema = z.object({
  ...shared,
  baseCurrency: z
    .string()
    .refine((v) => currencySet.has(v), { message: t('onboarding.v.currency') }),
})
export type OnboardingValues = z.infer<typeof onboardingSchema>

export const orgSettingsSchema = z.object(shared)
export type OrgSettingsValues = z.infer<typeof orgSettingsSchema>

export function toSettingsPayload(v: OrgSettingsValues): Required<OrgSettingsUpdate> {
  return {
    name: v.name.trim(),
    timezone: v.timezone,
    tax_rate: percentToDecimalString(v.taxRatePercent),
    prices_include_tax: v.pricesIncludeTax,
    fiscal_year_start_month: Number(v.fiscalYearStartMonth),
    date_format: v.dateFormat,
  }
}

export function toOrgPayload(v: OnboardingValues): OrgCreate {
  return { ...toSettingsPayload(v), base_currency: v.baseCurrency }
}

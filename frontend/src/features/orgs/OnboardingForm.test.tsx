import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingForm } from './OnboardingForm'
import { onboardingSchema, toOrgPayload } from './schemas'

describe('onboarding form', () => {
  it('rejects a missing base currency', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OnboardingForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Organisation name'), 'Al Noor Trading')
    await user.click(screen.getByRole('button', { name: 'Create organisation' }))

    expect(await screen.findByText('Choose a base currency')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('converts a 5% tax rate to "0.05" in the payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OnboardingForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Organisation name'), 'Al Noor Trading')
    await user.click(screen.getByLabelText('Base currency'))
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'OMR')
    await user.click(screen.getByRole('option', { name: /OMR/ }))
    const tax = screen.getByLabelText('Tax rate (%)')
    await user.clear(tax)
    await user.type(tax, '5')
    await user.click(screen.getByLabelText('Prices include tax'))
    await user.click(screen.getByRole('button', { name: 'Create organisation' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: 'Al Noor Trading',
      base_currency: 'OMR',
      tax_rate: '0.05',
      prices_include_tax: true,
      fiscal_year_start_month: 1,
      date_format: 'DD/MM/YYYY',
    })
    expect(typeof payload.timezone).toBe('string')
  })

  it('schema: no currency fails, 5% becomes "0.05"', () => {
    const base = {
      name: 'Org',
      timezone: 'Asia/Muscat',
      taxRatePercent: '5',
      pricesIncludeTax: false,
      fiscalYearStartMonth: '4',
      dateFormat: 'DD/MM/YYYY' as const,
    }
    const missing = onboardingSchema.safeParse({ ...base, baseCurrency: '' })
    expect(missing.success).toBe(false)
    expect(missing.error?.issues.some((i) => i.path[0] === 'baseCurrency')).toBe(true)

    const ok = onboardingSchema.parse({ ...base, baseCurrency: 'KES' })
    expect(toOrgPayload(ok)).toMatchObject({ tax_rate: '0.05', base_currency: 'KES', fiscal_year_start_month: 4 })
  })

  it('rejects out-of-range tax rates', () => {
    const r = onboardingSchema.shape.taxRatePercent
    expect(r.safeParse('100').success).toBe(false)
    expect(r.safeParse('-1').success).toBe(false)
    expect(r.safeParse('5.555').success).toBe(false)
    expect(r.safeParse('7.5').success).toBe(true)
  })
})

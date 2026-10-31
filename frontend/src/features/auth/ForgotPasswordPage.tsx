import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { useSupabase } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/strings'
import { AuthLayout } from './AuthLayout'
import { forgotSchema, type ForgotValues } from './schemas'

export function ForgotPasswordPage() {
  const supabase = useSupabase()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) setError(err.message)
    else setSentTo(email)
  })

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      footer={
        <Link to="/login" className="font-medium text-accent-text hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      }
    >
      {sentTo ? (
        <p role="status" className="surface-raised rounded-lg p-4 text-body text-fg-2">
          {t('auth.forgotSent', { email: sentTo })}
        </p>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('auth.forgotBody')}</p>
          <Field id="email" label={t('auth.email')} error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={describedBy('email', errors.email?.message)}
              {...form.register('email')}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-1" disabled={isSubmitting}>
            {isSubmitting ? t('auth.sending') : t('auth.forgotAction')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

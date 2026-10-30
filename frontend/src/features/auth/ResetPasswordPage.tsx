import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useAuth, useSupabase } from '@/auth/auth-context'
import { FullPageSpinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/strings'
import { AuthLayout } from './AuthLayout'
import { resetSchema, type ResetValues } from './schemas'

/** Landing page for the link sent by resetPasswordForEmail. Supabase signs the user in from the URL. */
export function ResetPasswordPage() {
  const supabase = useSupabase()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) setError(err.message)
    else navigate('/', { replace: true })
  })

  if (loading) return <FullPageSpinner />

  return (
    <AuthLayout
      title={t('auth.resetTitle')}
      footer={
        <Link to={session ? '/' : '/forgot-password'} className="font-medium text-petrol-500 hover:underline">
          {session ? t('errors.goHome') : t('auth.forgotAction')}
        </Link>
      }
    >
      {!session ? (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber">
          {t('auth.resetNoSession')}
        </p>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field id="password" label={t('auth.newPassword')} hint={t('auth.v.password')} error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={describedBy('password', errors.password?.message, true)}
              {...form.register('password')}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('auth.resetAction')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

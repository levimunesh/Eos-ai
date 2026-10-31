import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSupabase } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { describedBy, Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { safeNext } from '@/lib/format'
import { t } from '@/lib/strings'
import { AuthLayout } from './AuthLayout'
import { signInSchema, type SignInValues } from './schemas'

export function LoginPage() {
  const supabase = useSupabase()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword(values)
    if (err) {
      setError(err.message)
      return
    }
    navigate(safeNext(next), { replace: true })
  })

  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path)

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to={withNext('/signup')} className="font-medium text-accent-text hover:underline">
            {t('auth.createAccountLink')}
          </Link>
        </>
      }
    >
      {params.get('expired') && (
        <p role="status" className="mb-4 rounded-md bg-warning-soft px-3 py-2 text-body text-warning">
          {t('auth.sessionExpired')}
        </p>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
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
        <Field id="password" label={t('auth.password')} error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={describedBy('password', errors.password?.message)}
            {...form.register('password')}
          />
        </Field>
        <div className="-mt-1 flex justify-end">
          <Link to="/forgot-password" className="text-body text-accent-text hover:underline">
            {t('auth.forgotLink')}
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1" disabled={isSubmitting}>
          {isSubmitting ? t('auth.signingIn') : t('auth.signInAction')}
        </Button>
      </form>
    </AuthLayout>
  )
}

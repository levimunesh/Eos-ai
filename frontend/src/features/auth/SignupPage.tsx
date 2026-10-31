import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
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
import { signUpSchema, type SignUpValues } from './schemas'

export function SignupPage() {
  const supabase = useSupabase()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ fullName, email, password }) => {
    setError(null)
    const redirect = `${window.location.origin}${safeNext(next, '/')}`
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirect },
    })
    if (err) {
      setError(err.message)
      return
    }
    if (data.session) navigate(safeNext(next), { replace: true })
    else setSentTo(email)
  })

  const signInLink = (
    <Link
      to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
      className="font-medium text-accent-text hover:underline"
    >
      {t('auth.signInLink')}
    </Link>
  )

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.checkEmailTitle')} footer={signInLink}>
        <div className="flex items-start gap-3 surface-raised rounded-lg p-4">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          <p className="text-body text-fg-2">{t('auth.checkEmailBody', { email: sentTo })}</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      footer={
        <>
          {t('auth.haveAccount')} {signInLink}
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field id="fullName" label={t('auth.fullName')} error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            aria-invalid={!!errors.fullName}
            aria-describedby={describedBy('fullName', errors.fullName?.message)}
            {...form.register('fullName')}
          />
        </Field>
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
        <Field id="password" label={t('auth.password')} hint={t('auth.v.password')} error={errors.password?.message}>
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
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1" disabled={isSubmitting}>
          {isSubmitting ? t('auth.signingUp') : t('auth.signUpAction')}
        </Button>
      </form>
    </AuthLayout>
  )
}

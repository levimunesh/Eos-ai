import { ArrowLeft, LogOut } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Wordmark } from '@/app/Wordmark'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { orgStore } from '@/lib/org-store'
import { useCreateOrg, useMeQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useToast } from '@/lib/toast'
import { OnboardingForm } from './OnboardingForm'

export function OnboardingPage() {
  const me = useMeQuery()
  const createOrg = useCreateOrg()
  const navigate = useNavigate()
  const toast = useToast()
  const { signOut } = useAuth()
  const [params] = useSearchParams()
  const hasOrgs = (me.data?.memberships.length ?? 0) > 0
  const initialStep = Math.min(2, Math.max(0, Number(params.get('step') ?? 1) - 1)) || 0

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-6">
        <Wordmark />
        {hasOrgs ? (
          <Link to="/" className="inline-flex min-h-10 items-center gap-1.5 text-body text-accent-text hover:underline">
            <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
            {t('onboarding.backToApp')}
          </Link>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut aria-hidden />
            {t('common.signOut')}
          </Button>
        )}
      </header>
      <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-2 mb-8 text-body text-muted">{t('onboarding.intro')}</p>
        <div className="surface-raised rounded-lg p-5 sm:p-7">
          <OnboardingForm
            initialStep={initialStep}
            error={createOrg.error}
            onSubmit={async (payload) => {
              try {
                const org = await createOrg.mutateAsync(payload)
                orgStore.set(org.id)
                toast.success(t('org.created', { name: org.name }))
                navigate('/', { replace: true })
              } catch {
                // Shown through createOrg.error.
              }
            }}
          />
        </div>
      </main>
    </div>
  )
}

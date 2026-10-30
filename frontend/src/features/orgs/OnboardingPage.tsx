import { ArrowLeft, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Wordmark } from '@/app/Wordmark'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { orgStore } from '@/lib/org-store'
import { useCreateOrg, useMeQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { OnboardingForm } from './OnboardingForm'

export function OnboardingPage() {
  const me = useMeQuery()
  const createOrg = useCreateOrg()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const hasOrgs = (me.data?.memberships.length ?? 0) > 0

  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-6">
        <Wordmark tone="dark" />
        {hasOrgs ? (
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-petrol-500 hover:underline">
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('onboarding.backToApp')}
          </Link>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut aria-hidden />
            {t('common.signOut')}
          </Button>
        )}
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-semibold">{t('onboarding.title')}</h1>
        <p className="mt-2 mb-8 text-sm text-muted">{t('onboarding.intro')}</p>
        <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
          <OnboardingForm
            error={createOrg.error}
            onSubmit={async (payload) => {
              try {
                const org = await createOrg.mutateAsync(payload)
                orgStore.set(org.id)
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

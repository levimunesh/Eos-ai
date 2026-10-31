import { CircleAlert } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Wordmark } from '@/app/Wordmark'
import { useAuth } from '@/auth/auth-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { errorMessage, isApiError } from '@/lib/api'
import { orgStore } from '@/lib/org-store'
import { useAcceptInvitation } from '@/lib/queries'
import { t } from '@/lib/strings'

export function InvitePage() {
  const { token = '' } = useParams()
  const { session, signOut } = useAuth()
  const accept = useAcceptInvitation()
  const navigate = useNavigate()
  const email = session?.user.email ?? ''

  const err = accept.error
  const code = isApiError(err) ? err.code : null
  let message: string | null = null
  if (err) {
    if (code === 'invalid_invitation' || code === 'not_found') message = t('invite.invalid')
    else if (code === 'already_member') message = t('invite.alreadyMember')
    else message = errorMessage(err)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-14 items-center border-b border-line px-4 sm:px-6">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-md surface-raised rounded-lg p-6">
          <h1 className="text-xl font-semibold">{t('invite.title')}</h1>
          <p className="mt-2 text-body text-fg-2">{t('invite.body', { email })}</p>

          {message && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-1">
                <span>{message}</span>
                {code === 'email_mismatch' && <span className="text-fg-2">{t('invite.mismatchHint')}</span>}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
            {code === 'email_mismatch' ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void signOut().then(() =>
                    navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`, { replace: true }),
                  )
                }
              >
                {t('common.signOut')}
              </Button>
            ) : (
              <Link to="/" className={buttonVariants({ variant: 'ghost' })}>
                {t('invite.openApp')}
              </Link>
            )}
            {code !== 'already_member' && (
              <Button
                disabled={accept.isPending || accept.isSuccess}
                onClick={() =>
                  accept.mutate(token, {
                    onSuccess: ({ org_id }) => {
                      orgStore.set(org_id)
                      navigate('/', { replace: true })
                    },
                  })
                }
              >
                {accept.isPending ? t('invite.accepting') : t('invite.accept')}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
